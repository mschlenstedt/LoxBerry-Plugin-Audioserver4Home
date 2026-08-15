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
		_cleanup_old_images();
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
		_cleanup_old_images();
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
			my (undef, undef, $container) = _as_image();
			my $id = `sudo docker ps --filter 'name=^/$container\$' --filter status=running --format '{{.ID}}' 2>/dev/null`;
			chomp ($id);
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

if( $q->{action} eq "getversions" ) {
	# Image repo and current tag are taken from docker-compose.yml, so a future
	# rename of the upstream project only has to be applied there (and in the
	# upgrade migration) - not in every script.
	my ($repo, $current) = _as_image();
	my ($path) = $repo =~ m{^ghcr\.io/(.+)$};
	if ( !$path ) {
		$error = "Image in docker-compose.yml is not hosted on ghcr.io";
	} else {
		# Step 1: get anonymous pull token from ghcr.io
		my $token_json = `curl -sf --max-time 10 'https://ghcr.io/token?scope=repository:$path:pull&service=ghcr.io' 2>/dev/null`;
		if ( !$token_json ) {
			$error = "Could not reach ghcr.io";
		} else {
			my $token_data = eval { decode_json($token_json) };
			my $token      = $token_data ? $token_data->{token} : '';
			if ( !$token ) {
				$error = "Could not obtain ghcr.io token";
			} else {
				# Step 2: fetch tags list
				my $tags_json = `curl -sf --max-time 10 -H "Authorization: Bearer $token" 'https://ghcr.io/v2/$path/tags/list' 2>/dev/null`;
				my $tags_data = $tags_json ? eval { decode_json($tags_json) } : undef;
				# All named tags, sort descending
				my @versions  = sort { $b cmp $a } @{ $tags_data ? $tags_data->{tags} : [] };
				$response = encode_json( { tags => \@versions, current => $current } );
			}
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
			$cfg->{loxaudioserver}->{port} = 7090;
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
					# Replace the tag only - independent of the image repo, so this
					# keeps working if the upstream project is renamed again.
					my (undef, $oldversion) = _as_image();
					$compose =~ s{^(\s*image:\s*[^\s:]+):\S+}{$1:$q->{version}}m;
					LoxBerry::System::write_file("$lbpconfigdir/docker-compose.yml", $compose);
					# A version change only takes effect once the container is recreated; recreate it
					# (only when the tag actually changed and the service runs internally).
					if ( (!defined $oldversion || $oldversion ne $q->{version}) && (!defined $q->{internal} || $q->{internal} ne '0') ) {
						system("$lbpbindir/as_watchdog.pl --action=restart --verbose=0 > /dev/null 2>&1 &");
					}
				}
			}
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
	# Passed straight through from the AudioServer's own API. Its shape
	# ({"zones":[...]}) is what the Player Manager already expects.
	require LoxBerry::JSON;
	my $cfgobj = LoxBerry::JSON->new();
	my $cfg    = $cfgobj->open(filename => "$lbpconfigdir/plugin.json", readonly => 1);
	my $host   = $cfg ? ($cfg->{loxaudioserver}{host} // 'localhost') : 'localhost';
	my $port   = $cfg ? ($cfg->{loxaudioserver}{port} // 7090) : 7090;
	$host =~ s/[^a-zA-Z0-9.\-]//g;
	$port =~ s/[^0-9]//g;
	$port ||= 7090;

	my $json = `curl -sf --max-time 3 --connect-timeout 3 'http://$host:$port/api/v1/zones' 2>/dev/null`;

	# Anything unusable becomes an empty object with HTTP 200 - the Player
	# Manager treats a missing data.zones as "not reachable" and renders an
	# empty grid, so it needs no error handling of its own.
	$response = ( $json && eval { decode_json($json) } ) ? $json : '{}';
}

# Image repo, tag and container name of the AudioServer, read from the
# docker-compose.yml the plugin ships and maintains.
sub _as_image {
	my $compose = LoxBerry::System::read_file("$lbpconfigdir/docker-compose.yml") // '';
	my ($repo, $tag)  = $compose =~ m{^\s*image:\s*([^\s:]+):(\S+)}m;
	my ($container)   = $compose =~ m{^\s*container_name:\s*(\S+)}m;
	return ( $repo // 'ghcr.io/sonn-audio/core', $tag // '', $container // 'sonn-core' );
}

sub _cleanup_old_images {
	my ($repo, $current) = _as_image();
	return unless $current;
	my @images = `sudo docker image ls --format '{{.Repository}}:{{.Tag}}' 2>/dev/null`;
	for my $img (@images) {
		chomp $img;
		# Own images of another tag - plus leftovers of the old, renamed project
		# (ghcr.io/lox-audioserver/lox-audioserver), which are dead weight now.
		next unless $img =~ m{^\Q$repo\E:} || $img =~ m{^ghcr\.io/lox-audioserver/lox-audioserver:};
		next if $img eq "$repo:$current";
		system("sudo docker image rm \Q$img\E > /dev/null 2>&1 &");
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
