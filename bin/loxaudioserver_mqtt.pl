#!/usr/bin/perl
# loxaudioserver_mqtt.pl
# MQTT Gateway for lox-audioserver — LoxBerry Plugin Daemon

use strict;
use warnings;
use Getopt::Long qw(:config no_ignore_case);
use LoxBerry::System;
use LoxBerry::Log;
use LoxBerry::IO;
use LoxBerry::JSON;
use LWP::UserAgent;
use HTTP::Cookies;
use JSON;

# ---------------------------------------------------------------------------
# Kommandozeilenargumente
# ---------------------------------------------------------------------------
my $verbose = 0;
GetOptions(
    'v|verbose' => \$verbose,
) or do {
    print STDERR "Usage: $0 [-v|--verbose]\n";
    exit 1;
};

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
my $log = LoxBerry::Log->new(
    name    => 'loxaudioserver-mqtt',
    package => $lbpplugindir,
    append  => 1,
    addtime => 1,
    stdout  => $verbose,
);
if ($verbose) {
    $log->loglevel(7);
}
$log->LOGSTART('lox-audioserver MQTT Gateway gestartet');

# ---------------------------------------------------------------------------
# Config laden
# ---------------------------------------------------------------------------
my $cfgobj = LoxBerry::JSON->new();
my $cfg    = $cfgobj->open(
    filename => "$lbpconfigdir/plugin.json",
    readonly => 1,
);
unless ($cfg) {
    LOGCRIT("Konfigurationsfehler: plugin.json konnte nicht geladen werden ($lbpconfigdir/plugin.json)");
    exit 1;
}

my $host      = $cfg->{loxaudioserver}{host};
my $port      = $cfg->{loxaudioserver}{port} // 7090;
my $basetopic = $cfg->{mqtt}{basetopic}       // 'loxaudioserver';

unless ($host) {
    LOGCRIT("Konfigurationsfehler: loxaudioserver.host fehlt in plugin.json");
    exit 1;
}
LOGINF("lox-audioserver: http://$host:$port");
LOGINF("MQTT Basetopic: $basetopic");

# ---------------------------------------------------------------------------
# Miniserver-Credentials
# Pass_RAW / Admin_RAW enthalten das Klartext-Passwort (nicht URL-kodiert).
# Pass / Admin sind URL-kodiert und würden den Miniserver-Auth-Hash korrumpieren.
# Miniserver 0 = keine Authentifizierung erforderlich.
# ---------------------------------------------------------------------------
my $ms_nr = ($cfg->{mqtt}{miniserver} // 1) + 0;
my ($lox_user, $lox_pass);
if ($ms_nr == 0) {
    LOGINF("Miniserver-Authentifizierung deaktiviert (Miniserver 0) – kein Login erforderlich");
} else {
    my %ms = LoxBerry::System::get_miniservers();
    unless ($ms{$ms_nr} && $ms{$ms_nr}{Admin_RAW} && $ms{$ms_nr}{Pass_RAW}) {
        LOGCRIT("Miniserver #$ms_nr nicht konfiguriert oder fehlende Admin/Pass-Credentials");
        exit 1;
    }
    $lox_user = $ms{$ms_nr}{Admin_RAW};
    $lox_pass = $ms{$ms_nr}{Pass_RAW};
    LOGINF("Miniserver #$ms_nr ($ms{$ms_nr}{Name}) – Benutzer: $lox_user");
}

# ---------------------------------------------------------------------------
# MQTT-Verbindung mit LWT
# ---------------------------------------------------------------------------
my $mqtt = LoxBerry::IO::mqtt_connect();
unless ($mqtt) {
    LOGCRIT("MQTT-Broker nicht erreichbar – Gateway wird beendet");
    exit 1;
}

# LWT muss VOR dem ersten Publish gesetzt werden (Net::MQTT::Simple verbindet lazy)
$mqtt->last_will("$basetopic/gateway/active", "0", 1);

# Erster Publish: TCP-Verbindung + CONNECT-Paket (inkl. LWT) wird jetzt aufgebaut
my $pub_ok = LoxBerry::IO::mqtt_retain("$basetopic/gateway/active", "1");
LOGWARN("Erster MQTT-Publish fehlgeschlagen – Status-Topic möglicherweise nicht aktuell")
    unless $pub_ok;
LOGOK("MQTT verbunden, LWT gesetzt ($basetopic/gateway/active → 0 bei Absturz)");

# ---------------------------------------------------------------------------
# SHM-Datei
# ---------------------------------------------------------------------------
my $shm_file = '/dev/shm/audioserver4home.json';

# ---------------------------------------------------------------------------
# Signal-Handler für graceful Shutdown
# ---------------------------------------------------------------------------
$SIG{TERM} = $SIG{INT} = sub {
    LOGINF("Shutdown-Signal empfangen – publiziere gateway/active=0");
    LoxBerry::IO::mqtt_retain("$basetopic/gateway/active", "0")
        or LOGWARN("Shutdown-Publish fehlgeschlagen");
    if (open(my $fh, '>', $shm_file)) {
        print $fh '{}';
        close $fh;
        LOGINF("SHM-Datei geleert ($shm_file)");
    } else {
        LOGWARN("SHM-Datei konnte nicht geleert werden ($shm_file): $!");
    }
    $log->LOGEND("Gateway beendet");
    exit 0;
};

# ---------------------------------------------------------------------------
# HTTP-Client
# ---------------------------------------------------------------------------
my $jar      = HTTP::Cookies->new();
my $ua       = LWP::UserAgent->new(timeout => 10, cookie_jar => $jar);
my $base_url = "http://$host:$port";

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------
sub login {
    unless (defined $lox_user && defined $lox_pass) {
        LOGINF("Login übersprungen – Authentifizierung deaktiviert");
        return 1;
    }
    my $resp = $ua->post(
        "$base_url/admin/api/auth/login",
        Content_Type => 'application/json',
        Content      => encode_json({ username => $lox_user, password => $lox_pass }),
    );
    unless ($resp->is_success) {
        LOGCRIT("Login HTTP-Fehler: " . $resp->status_line);
        return 0;
    }
    my $data = eval { decode_json($resp->content) };
    if ($@ || (ref $data eq 'HASH' && $data->{error})) {
        my $err_msg = $@ ? "JSON-Parse-Fehler: $@"
                    : $data->{error};
        LOGCRIT("Login abgelehnt: $err_msg");
        return 0;
    }
    LOGOK("lox-audioserver Login erfolgreich (Benutzer: $lox_user)");
    return 1;
}

sub fetch_json {
    my ($path) = @_;
    my $resp = $ua->get("$base_url$path");
    unless ($resp->is_success) {
        LOGERR("HTTP-Fehler bei $path: " . $resp->status_line);
        # Note: lox-audioserver returns 200 + {"error":"auth-required"} for auth failures,
        # not HTTP 401/403, so we don't need a special case here.
        return undef;
    }
    my $data = eval { decode_json($resp->content) };
    if ($@) {
        LOGERR("JSON-Parse-Fehler bei $path: $@");
        return undef;
    }
    if (ref $data eq 'HASH' && ($data->{error} // '') eq 'auth-required') {
        LOGWARN("Session abgelaufen – Re-Login erforderlich");
        return 'AUTH_REQUIRED';
    }
    return $data;
}

# ---------------------------------------------------------------------------
# Initialer Login
# ---------------------------------------------------------------------------
unless (login()) {
    LOGCRIT("Erster Login-Versuch fehlgeschlagen – warte 30s und versuche erneut");
    sleep(30);
    unless (login()) {
        LOGCRIT("Login nach Retry fehlgeschlagen – Gateway wird beendet");
        exit 1;
    }
}

# ---------------------------------------------------------------------------
# Zustandsverfolgung
# ---------------------------------------------------------------------------
my %last_state;

sub publish_if_changed {
    my ($topic, $value) = @_;

    # Normalisierung: undef → '', Array → kommagetrennt, Bool → 1/0, Rest → String
    if (!defined $value) {
        $value = '';
    } elsif (ref $value eq 'ARRAY') {
        $value = join(',', @$value);
    } elsif (JSON::is_bool($value)) {
        $value = $value ? '1' : '0';
    } else {
        $value = "$value";
    }

    # Nur publishen wenn geändert
    return if defined $last_state{$topic} && $last_state{$topic} eq $value;

    my $old = defined $last_state{$topic} ? $last_state{$topic} : '<neu>';
    LOGDEB("Änderung: $topic  '$old' → '$value'");

    my $result = LoxBerry::IO::mqtt_retain($topic, $value);
    LOGWARN("MQTT publish fehlgeschlagen: $topic => $value") unless defined $result;

    $last_state{$topic} = $value;
}

# ---------------------------------------------------------------------------
# SHM-Datei schreiben
# ---------------------------------------------------------------------------
sub write_shm {
    my ($data) = @_;
    my $json = eval { JSON->new->utf8->pretty(0)->encode($data) };
    if ($@) {
        LOGWARN("SHM JSON-Encode fehlgeschlagen: $@");
        return;
    }
    my $tmp = "$shm_file.tmp";
    if (open(my $fh, '>', $tmp)) {
        print $fh $json;
        close $fh;
        rename($tmp, $shm_file)
            or LOGWARN("SHM rename fehlgeschlagen: $!");
    } else {
        LOGWARN("SHM-Datei konnte nicht geschrieben werden ($shm_file): $!");
    }
}

# ---------------------------------------------------------------------------
# Polling: Wiedergabestatus, Metadaten, Session, StreamStats
# ---------------------------------------------------------------------------
my @TECH_FIELDS = qw(
    session/state session/elapsed session/duration
    streamStats/profile streamStats/bps streamStats/bufferedBytes
    streamStats/totalBytes streamStats/subscribers streamStats/restarts
    streamStats/subscriberDrops streamStats/lastError
);

sub process_zones {
    my ($data) = @_;

    my $sys = $data->{system} // {};
    my $la  = $sys->{loadavg};
    publish_if_changed("$basetopic/system/loadavg",
        (ref $la eq 'ARRAY' && defined $la->[0]) ? sprintf("%.2f", $la->[0]) : '');

    for my $zone (@{ $data->{zones} // [] }) {
        my $id = $zone->{id};
        my $z  = "$basetopic/zones/$id";

        publish_if_changed("$z/title",      $zone->{title});
        publish_if_changed("$z/artist",     $zone->{artist});
        publish_if_changed("$z/album",      $zone->{album});
        publish_if_changed("$z/station",    $zone->{station});
        publish_if_changed("$z/sourceName", $zone->{sourceName});
        publish_if_changed("$z/state",      $zone->{state});
        publish_if_changed("$z/powerState", $zone->{powerState});
        publish_if_changed("$z/coverUrl",   $zone->{coverUrl});

        my $tech = $zone->{tech};
        unless ($tech) {
            publish_if_changed("$z/$_", '') for @TECH_FIELDS;
            next;
        }

        my $sess = $tech->{session} // {};
        publish_if_changed("$z/session/state",    $sess->{state});
        publish_if_changed("$z/session/elapsed",  $sess->{elapsed});
        publish_if_changed("$z/session/duration", $sess->{duration});

        my $ss = (ref $tech->{streamStats} eq 'ARRAY' && @{ $tech->{streamStats} })
                 ? $tech->{streamStats}[0] : {};
        publish_if_changed("$z/streamStats/profile",         $ss->{profile});
        publish_if_changed("$z/streamStats/bps",             $ss->{bps});
        publish_if_changed("$z/streamStats/bufferedBytes",   $ss->{bufferedBytes});
        publish_if_changed("$z/streamStats/totalBytes",      $ss->{totalBytes});
        publish_if_changed("$z/streamStats/subscribers",     $ss->{subscribers});
        publish_if_changed("$z/streamStats/restarts",        $ss->{restarts});
        publish_if_changed("$z/streamStats/subscriberDrops", $ss->{subscriberDrops});
        publish_if_changed("$z/streamStats/lastError",       $ss->{lastError});
    }
}

# ---------------------------------------------------------------------------
# Polling Slow: Zonenname, Routing, Input/Output-Konfiguration, Streams
# Läuft mit polling-Intervall wenn eine Zone spielt, sonst mit polling_slow-Intervall
# ---------------------------------------------------------------------------
my @TECH_FIELDS_PLAY = qw(
    inputProvider outputTarget outputs transports
    input/kind input/format input/sampleRate input/channels
    output/profiles output/sampleRate output/channels output/bitrate
    output/pcmBitDepth output/resampler output/resamplePrecision
    output/resampleCutoff output/prebufferBytes output/httpFallbackSeconds
    streams/mp3 streams/pcm
);

sub process_zones_play {
    my ($data) = @_;

    my $sys = $data->{system} // {};
    publish_if_changed("$basetopic/system/uptimeSec",     $sys->{uptimeSec});
    publish_if_changed("$basetopic/system/clockOffsetMs", $sys->{clockOffsetMs});
    publish_if_changed("$basetopic/system/cores",         $sys->{cores});

    for my $zone (@{ $data->{zones} // [] }) {
        my $id = $zone->{id};
        my $z  = "$basetopic/zones/$id";

        publish_if_changed("$z/name", $zone->{name});

        my $tech = $zone->{tech};
        unless ($tech) {
            publish_if_changed("$z/$_", '') for @TECH_FIELDS_PLAY;
            next;
        }

        publish_if_changed("$z/inputProvider", $tech->{inputProvider});
        publish_if_changed("$z/outputTarget",  $tech->{outputTarget});
        publish_if_changed("$z/outputs",       $tech->{outputs});
        publish_if_changed("$z/transports",    $tech->{transports});

        my $inp = $tech->{input} // {};
        publish_if_changed("$z/input/kind",       $inp->{kind});
        publish_if_changed("$z/input/format",     $inp->{format});
        publish_if_changed("$z/input/sampleRate", $inp->{sampleRate});
        publish_if_changed("$z/input/channels",   $inp->{channels});

        my $out = $tech->{output} // {};
        publish_if_changed("$z/output/profiles",            $out->{profiles});
        publish_if_changed("$z/output/sampleRate",          $out->{sampleRate});
        publish_if_changed("$z/output/channels",            $out->{channels});
        publish_if_changed("$z/output/bitrate",             $out->{bitrate});
        publish_if_changed("$z/output/pcmBitDepth",         $out->{pcmBitDepth});
        publish_if_changed("$z/output/resampler",           $out->{resampler});
        publish_if_changed("$z/output/resamplePrecision",   $out->{resamplePrecision});
        publish_if_changed("$z/output/resampleCutoff",      $out->{resampleCutoff});
        publish_if_changed("$z/output/prebufferBytes",      $out->{prebufferBytes});
        publish_if_changed("$z/output/httpFallbackSeconds", $out->{httpFallbackSeconds});

        my $streams = $tech->{streams} // {};
        publish_if_changed("$z/streams/mp3", $streams->{mp3});
        publish_if_changed("$z/streams/pcm", $streams->{pcm});
    }
}

# ---------------------------------------------------------------------------
# Haupt-Polling-Schleife
# ---------------------------------------------------------------------------
my $polling_interval      = $cfg->{mqtt}{polling}      // 1;
my $polling_slow_interval = $cfg->{mqtt}{polling_slow} // 60;
LOGINF("Poll-Intervall: ${polling_interval}s  Poll-Intervall Play: ${polling_slow_interval}s");
LOGOK("Gateway bereit – starte Polling-Schleife");

# Polling Slow beim Start sofort auslösen
my $play_elapsed = $polling_slow_interval;
my $was_playing  = 0;

while (1) {
    my $data = fetch_json('/admin/api/zones/states');

    if (!defined $data) {
        LOGWARN("Abruf fehlgeschlagen – warte ${polling_interval}s");
        sleep($polling_interval);
        next;
    }

    if ($data eq 'AUTH_REQUIRED') {
        unless (defined $lox_user) {
            LOGERR("Server verlangt Authentifizierung, obwohl sie deaktiviert ist – warte ${polling_interval}s");
            sleep($polling_interval);
            next;
        }
        LOGINF("Session abgelaufen – Re-Login...");
        unless (login()) {
            LOGERR("Re-Login fehlgeschlagen – warte 30s");
            sleep(30);
            next;
        }
        $data = fetch_json('/admin/api/zones/states');
        unless (defined $data && $data ne 'AUTH_REQUIRED') {
            LOGERR("Abruf nach Re-Login fehlgeschlagen – warte ${polling_interval}s");
            sleep($polling_interval);
            next;
        }
    }

    LOGDEB("Polling Fast");
    process_zones($data);
    write_shm($data);

    # Polling Slow: bei spielender Zone jeden Zyklus, sonst nach polling_slow_interval
    my $any_playing = grep { ($_->{state} // '') eq 'play' } @{ $data->{zones} // [] };
    if ($any_playing && !$was_playing) {
        LOGDEB("Polling Slow: Intervall wechselt auf ${polling_interval}s (Zone spielt)");
    } elsif (!$any_playing && $was_playing) {
        LOGDEB("Polling Slow: Abschliessender Abruf vor Intervallwechsel auf ${polling_slow_interval}s");
        process_zones_play($data);
        $play_elapsed = 0;
        LOGDEB("Polling Slow: Intervall wechselt auf ${polling_slow_interval}s (keine Zone spielt)");
    }
    $was_playing = $any_playing;

    if ($any_playing || $play_elapsed >= $polling_slow_interval) {
        LOGDEB("Polling Slow");
        process_zones_play($data);
        $play_elapsed = 0;
    }

    $play_elapsed += $polling_interval;
    sleep($polling_interval);
}
