#!/usr/bin/perl
use warnings;
use strict;
use LoxBerry::System;
use CGI;
use JSON;

my $error;
my $response;
my $cgi = CGI->new;
my $q = $cgi->Vars;

if( $q->{action} eq "asservicerestart" ) {
	require LoxBerry::JSON;
	my $cfgobj = LoxBerry::JSON->new();
	my $cfg = $cfgobj->open(filename => "$lbpconfigdir/plugin.json", readonly => 1);
	if ($cfg && !$cfg->{loxaudioserver}{internal}) {
		$response = "0";
	} else {
		system ("$lbpbindir/as_watchdog.pl --action=restart --verbose=0 > /dev/null 2>&1 &");
		my $resp = $?;
		sleep(1);
		my $status = LoxBerry::System::lock(lockfile => 'as-watchdog', wait => 600);
		$response = $resp;
	}
}

if( $q->{action} eq "asservicestop" ) {
	require LoxBerry::JSON;
	my $cfgobj = LoxBerry::JSON->new();
	my $cfg = $cfgobj->open(filename => "$lbpconfigdir/plugin.json", readonly => 1);
	if ($cfg && !$cfg->{loxaudioserver}{internal}) {
		$response = "0";
	} else {
		system ("$lbpbindir/as_watchdog.pl --action=stop --verbose=0 > /dev/null 2>&1");
		$response = $?;
	}
}

if( $q->{action} eq "asservicestatus" ) {
	require LoxBerry::JSON;
	my $cfgobj = LoxBerry::JSON->new();
	my $cfg = $cfgobj->open(filename => "$lbpconfigdir/plugin.json", readonly => 1);
	if (!$cfg) {
		$response = encode_json({});
	} else {
		my $internal = $cfg->{loxaudioserver}{internal} ? 1 : 0;
		if ($internal) {
			my $id;
			my $count = `sudo docker ps | grep -c Up.*lox-audioserver`;
			if ($count >= "1") {
				$id = `sudo docker ps | grep Up.*lox-audioserver | awk '{ print \$1 }'`;
				chomp ($id);
			}
			my %resp = ( pid => $id );
			$response = encode_json( \%resp );
		} else {
			my $host = $cfg->{loxaudioserver}{host} // 'localhost';
			my $port = $cfg->{loxaudioserver}{port} // 7090;
			$host =~ s/[^a-zA-Z0-9.\-]//g;
			$port =~ s/[^0-9]//g;
			$port ||= 7090;
			my $code = `curl -sf --max-time 3 --connect-timeout 3 -o /dev/null -w "%{http_code}" 'http://$host:$port' 2>/dev/null`;
			chomp($code);
			if ($code && $code ne '000') {
				$response = encode_json({ pid => 'Remote' });
			} else {
				$response = encode_json({});
			}
		}
	}
}

if( $q->{action} eq "gwservicerestart" ) {
	system ("$lbpbindir/gw_watchdog.pl --action=restart --verbose=0 > /dev/null 2>&1 &");
	my $resp = $?;
	sleep(1);
	my $status = LoxBerry::System::lock(lockfile => 'gw-watchdog', wait => 600);
	$response = $resp;
}

if( $q->{action} eq "gwservicestop" ) {
	system ("$lbpbindir/gw_watchdog.pl --action=stop --verbose=0 > /dev/null 2>&1");
	$response = $?;
}

if( $q->{action} eq "gwservicestatus" ) {
	my $id;
	my $count = `pgrep -A -c -f "loxaudioserver_mqtt.pl"`;
	chomp ($count);
	if ($count >= "1") {
		$id = `pgrep -A -f "loxaudioserver_mqtt.pl"`;
		chomp ($id);
	}
	my %response = ( pid => $id );
	chomp (%response);
	$response = encode_json( \%response );
}

if( $q->{action} eq "getminiservers" ) {
	require LoxBerry::JSON;
	my %ms_raw = LoxBerry::System::get_miniservers();
	my @ms_list;
	for my $nr ( sort { $a <=> $b } keys %ms_raw ) {
		push @ms_list, { nr => $nr+0, name => $ms_raw{$nr}{Name} };
	}
	my $cfgobj  = LoxBerry::JSON->new();
	my $cfg     = $cfgobj->open(filename => "$lbpconfigdir/plugin.json", readonly => 1);
	my $current = ($cfg && defined $cfg->{mqtt}{miniserver}) ? $cfg->{mqtt}{miniserver}+0 : 1;
	$response   = encode_json({ miniservers => \@ms_list, current => $current });
}

if( $q->{action} eq "getversions" ) {
	# Step 1: get anonymous pull token from ghcr.io
	my $token_json = `curl -sf --max-time 10 'https://ghcr.io/token?scope=repository:lox-audioserver/lox-audioserver:pull&service=ghcr.io' 2>/dev/null`;
	if ( !$token_json ) {
		$error = "Could not reach ghcr.io";
	} else {
		my $token_data = eval { decode_json($token_json) };
		my $token      = $token_data ? $token_data->{token} : '';
		if ( !$token ) {
			$error = "Could not obtain ghcr.io token";
		} else {
			# Step 2: fetch tags list
			my $tags_json = `curl -sf --max-time 10 -H "Authorization: Bearer $token" 'https://ghcr.io/v2/lox-audioserver/lox-audioserver/tags/list' 2>/dev/null`;
			my $tags_data = $tags_json ? eval { decode_json($tags_json) } : undef;
			# All named tags, sort descending
			my @versions  = sort { $b cmp $a } @{ $tags_data ? $tags_data->{tags} : [] };
			# Current version from docker-compose.yml
			my $compose   = LoxBerry::System::read_file("$lbpconfigdir/docker-compose.yml") // '';
			my ($current) = $compose =~ /image:\s*\S+:(\S+)/;
			$response = encode_json( { tags => \@versions, current => $current // '' } );
		}
	}
}

if( $q->{action} eq "saveasettings" ) {
	require LoxBerry::JSON;
	my $cfgfile = "$lbpconfigdir/plugin.json";
	my $jsonobj = LoxBerry::JSON->new();
	my $cfg = $jsonobj->open(filename => $cfgfile);
	if ( !$cfg ) {
		$error = "Could not open config file";
	} else {
		$cfg->{loxaudioserver}->{internal} = $q->{internal} ? JSON::true : JSON::false if defined $q->{internal};
		if ( $q->{internal} ) {
			$cfg->{loxaudioserver}->{host} = 'localhost';
			$cfg->{loxaudioserver}->{port} = 7092;
		} else {
			$cfg->{loxaudioserver}->{host} = $q->{host} if defined $q->{host};
			$cfg->{loxaudioserver}->{port} = $q->{port}+0 if defined $q->{port};
		}
		eval { $jsonobj->write() };
		if ( $@ ) {
			$error = "Could not save settings: $@";
		} else {
			if ( defined $q->{internal} && $q->{internal} eq '0' ) {
				system("$lbpbindir/as_watchdog.pl --action=stop --verbose=0 > /dev/null 2>&1 &");
			}
			# Save version to docker-compose.yml if provided and valid
			if ( defined $q->{version} && $q->{version} =~ /^[\w.\-]+$/ ) {
				my $compose = LoxBerry::System::read_file("$lbpconfigdir/docker-compose.yml");
				if ( $compose ) {
					$compose =~ s{(image:\s*ghcr\.io/lox-audioserver/lox-audioserver:)\S+}{$1$q->{version}};
					LoxBerry::System::write_file("$lbpconfigdir/docker-compose.yml", $compose);
				}
			}
			$response = encode_json( { ok => 1 } );
		}
	}
}

if( $q->{action} eq "savegwsettings" ) {
	require LoxBerry::JSON;
	my $cfgfile = "$lbpconfigdir/plugin.json";
	my $jsonobj = LoxBerry::JSON->new();
	my $cfg = $jsonobj->open(filename => $cfgfile);
	if ( !$cfg ) {
		$error = "Could not open config file";
	} else {
		$cfg->{mqtt}->{basetopic}    = $q->{basetopic}          if defined $q->{basetopic};
		$cfg->{mqtt}->{polling}      = $q->{polling}+0          if defined $q->{polling};
		$cfg->{mqtt}->{polling_slow} = $q->{polling_slow}+0     if defined $q->{polling_slow};
		$cfg->{mqtt}->{miniserver}   = $q->{miniserver}+0       if defined $q->{miniserver};
		eval { $jsonobj->write() };
		if ( $@ ) {
			$error = "Could not save settings: $@";
		} else {
			$response = encode_json( { ok => 1 } );
		}
	}
}

if( $q->{action} eq "getconfig" ) {
	require LoxBerry::JSON;
	my $cfgfile = "$lbpconfigdir/plugin.json";
	my $jsonobj = LoxBerry::JSON->new();
	my $cfg = $jsonobj->open(filename => $cfgfile, readonly => 1);
	$response = encode_json( $cfg );
}

if( $q->{action} eq "getzones" ) {
	my $shm_file = '/dev/shm/audioserver4home.json';
	if ( open(my $fh, '<:utf8', $shm_file) ) {
		local $/;
		$response = <$fh>;
		close $fh;
		# Empty or missing SHM content: treat as offline
		$response = '{}' if !$response || $response =~ /^\s*$/;
	} else {
		# File doesn't exist (gateway never started or cleared on shutdown)
		# Return empty JSON with 200; JS checks for data.zones to detect offline state
		$response = '{}';
	}
}

if( defined $response and !defined $error ) {
	print "Status: 200 OK\r\n";
	print "Content-type: application/json; charset=utf-8\r\n\r\n";
	print $response;
}
elsif ( defined $error and $error ne "" ) {
	print "Status: 500 Internal Server Error\r\n";
	print "Content-type: application/json; charset=utf-8\r\n\r\n";
	print to_json( { error => $error } );
}
else {
	print "Status: 501 Not implemented\r\n";
	print "Content-type: application/json; charset=utf-8\r\n\r\n";
	print to_json( { error => "Action " . $q->{action} . " unknown" } );
}
