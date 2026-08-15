#!/usr/bin/perl

use LoxBerry::System;
use LoxBerry::IO;
use LoxBerry::Log;
use LoxBerry::JSON;
use Getopt::Long;
#use warnings;
#use strict;
#use Data::Dumper;

# Version of this script
my $version = "0.1.0";

# Globals
my $error;
my $verbose;
my $action;

# Logging
my $log = LoxBerry::Log->new (  name => "as_watchdog",
	package => 'audioserver4home',
	logdir => "$lbplogdir",
	addtime => 1,
);

# Commandline options
GetOptions ('verbose=s' => \$verbose,
            'action=s' => \$action);

# Verbose
if ($verbose) {
        $log->stdout(1);
        $log->loglevel(7);
}

LOGSTART "Starting AudioServer Watchdog";

# Lock
my $status = LoxBerry::System::lock(lockfile => 'as-watchdog', wait => 10);
if ($status) {
	LOGCRIT "$status currently running - Quitting.";
	exit (1);
}

# Creating tmp file with failed checks
my $response;
if (!-e "/dev/shm/a4h-as-watchdog-fails.dat") {
	$response = LoxBerry::System::write_file("/dev/shm/a4h-as-watchdog-fails.dat", "0");
}

# Todo
if ( $action eq "start" ) {

	&start();

}

elsif ( $action eq "stop" ) {

	&stop();

}

elsif ( $action eq "restart" ) {

	&restart();

}

elsif ( $action eq "check" ) {

	&check();

}

else {

	LOGERR "No valid action specified. --action=start|stop|restart|check is required. Exiting.";
	print "No valid action specified. --action=start|stop|restart|check is required. Exiting.\n";
	exit(1);

}

exit (0);


#############################################################################
# Sub routines
#############################################################################

##
## Start
##
sub start
{

	my $cfgobj2 = LoxBerry::JSON->new();
	my $cfg2 = $cfgobj2->open(filename => "$lbpconfigdir/plugin.json", readonly => 1);
	if ($cfg2 && !$cfg2->{loxaudioserver}{internal}) {
		LOGINF "AudioServer ist als extern konfiguriert – kein Start erforderlich.";
		return(0);
	}

	# Start with:
	if (-e  "$lbpconfigdir/as_stopped.cfg") {
		unlink("$lbpconfigdir/as_stopped.cfg");
	}

	if ( &container_id() ) {
		LOGCRIT "AudioServer already running. Please stop it before starting again. Exiting.";
		exit (1);
	}

	LOGINF "Starting AudioServer...";

	# Pull first: "up -d" reuses a locally present image, so rolling channel tags
	# (beta-latest, dev-latest, ...) would never receive an update without this.
	my $output = `sudo docker compose -f $lbpconfigdir/docker-compose.yml pull 2>&1`;
	$output .= `sudo docker compose -f $lbpconfigdir/docker-compose.yml up -d 2>&1`;
	chomp ($output);

	my $id = &container_id();
	if (!$id) {
		LOGCRIT "Could not start AudioServer - Error: $output";
		exit (1)
	} else {
		LOGOK "AudioServer started successfully. Container ID: $id";
	}

	return (0);

}

##
## Container name from docker-compose.yml, and the id of that container.
## Filtering by name is exact - grepping "docker ps" also matched the image
## column and broke as soon as the upstream project was renamed.
##
sub container_name
{

	my $compose = LoxBerry::System::read_file("$lbpconfigdir/docker-compose.yml") // '';
	my ($container) = $compose =~ m{^\s*container_name:\s*(\S+)}m;

	return ($container ? $container : "sonn-core");

}

sub container_id
{

	my $name = &container_name();
	my $id = `sudo docker ps --filter 'name=^/$name\$' --filter status=running --format '{{.ID}}' 2>/dev/null`;
	chomp ($id);

	return ($id);

}

sub stop
{

	$response = LoxBerry::System::write_file("$lbpconfigdir/as_stopped.cfg", "1");

	LOGINF "Stopping AudioServer...";
	my $output = `sudo docker compose -f $lbpconfigdir/docker-compose.yml down 2>&1`;
	chomp ($output);

	my $id = &container_id();
	if (!$id) {
		LOGOK "AudioServer stopped successfully.";
	} else {
		LOGCRIT "Could not stop AudioServer - Error: $output. Still Running ID: $id";
		exit (1)
	}

	return(0);

}

sub restart
{

	$log->default;
	LOGINF "Restarting AudioServer...";
	&stop();
	&start();

	return(0);

}

sub check
{

	LOGINF "Checking Status of AudioServer...";

	my $cfgobj2 = LoxBerry::JSON->new();
	my $cfg2 = $cfgobj2->open(filename => "$lbpconfigdir/plugin.json", readonly => 1);
	if ($cfg2 && !$cfg2->{loxaudioserver}{internal}) {
		LOGINF "AudioServer ist als extern konfiguriert – kein Check erforderlich.";
		return(0);
	}

	if (-e  "$lbpconfigdir/as_stopped.cfg") {
		LOGOK "AudioServer was stopped manually. Nothing to do.";
		return(0);
	}

	my $id = &container_id();
	if (!$id) {
		LOGERR "AudioServer seems not to be running.";
		my $fails = LoxBerry::System::read_file("/dev/shm/a4h-as-watchdog-fails.dat");
		chomp ($fails);
		$fails++;
		if ($fails > 9) {
			LOGERR "Too many failures. Will stop watchdogging... Check your configuration and start service manually.";
		} else {
			my $response = LoxBerry::System::write_file("/dev/shm/a4h-as-watchdog-fails.dat", "$fails");
			&restart();
		}
	} else {
		LOGOK "AudioServer is running. Fine. ID: $id";
		my $response = LoxBerry::System::write_file("/dev/shm/a4h-as-watchdog-fails.dat", "0");
	}

	return(0);

}

##
## Always execute when Script ends
##
END {

	LOGEND "This is the end - My only friend, the end...";
	LoxBerry::System::unlock(lockfile => 'as-watchdog');

}
