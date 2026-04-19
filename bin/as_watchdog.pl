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

LOGSTART "Starting Lox-Audioserver Watchdog";

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
		LOGINF "Lox-Audioserver ist als extern konfiguriert – kein Start erforderlich.";
		return(0);
	}

	# Start with:
	if (-e  "$lbpconfigdir/as_stopped.cfg") {
		unlink("$lbpconfigdir/as_stopped.cfg");
	}

	my $count = `sudo docker ps | grep -c Up.*lox-audioserver`;
	chomp ($count);
	if ($count > "0") {
		LOGCRIT "Lox-Audioserver already running. Please stop it before starting again. Exiting.";
		exit (1);
	}

	LOGINF "Starting Lox-Audioserver...";

	my $cfgfile = $lbpplugindir."/plugin.json";
	my $jsonobj = LoxBerry::JSON->new();
	$cfg = $jsonobj->open(filename => $cfgfile);
	my $release = $cfg->{lox-audioserver}->{release};
	if ( !$release) {
		$release = "latest";
	}

	my $output = `sudo docker compose -f $lbpconfigdir/docker-compose.yml up -d 2>&1`;
	chomp ($output);

	my $count = `sudo docker ps | grep -c Up.*lox-audioserver`;
	chomp ($count);
	if ($count eq "0") {
		LOGCRIT "Could not start Lox-Audioserver - Error: $output";
		exit (1)
	} else {
		my $id = `sudo docker ps | grep Up.*lox-audioserver | awk '{ print \$1 }'`;
		chomp ($id);
		LOGOK "Lox-Audioserver started successfully. Container ID: $id";
	}

	return (0);

}

sub stop
{

	$response = LoxBerry::System::write_file("$lbpconfigdir/as_stopped.cfg", "1");

	LOGINF "Stopping Lox-Audioserver...";
	my $output = `sudo docker compose -f $lbpconfigdir/docker-compose.yml down 2>&1`;
	chomp ($output);

	my $count = `sudo docker ps | grep -c lox-audioserver`;
	chomp ($count);
	if ($count eq "0") {
		LOGOK "Lox-Audioserver stopped successfully.";
	} else {
		my $id = `sudo docker ps | grep lox-audioserver | awk '{ print \$1 }'`;
		chomp ($id);
		LOGCRIT "Could not stop Lox-Audioserver - Error: $output. Still Running ID: $id";
		exit (1)
	}

	return(0);

}

sub restart
{

	$log->default;
	LOGINF "Restarting Lox-Audioserver...";
	&stop();
	&start();

	return(0);

}

sub check
{

	LOGINF "Checking Status of Lox-Audioserver...";

	my $cfgobj2 = LoxBerry::JSON->new();
	my $cfg2 = $cfgobj2->open(filename => "$lbpconfigdir/plugin.json", readonly => 1);
	if ($cfg2 && !$cfg2->{loxaudioserver}{internal}) {
		LOGINF "Lox-Audioserver ist als extern konfiguriert – kein Check erforderlich.";
		return(0);
	}

	if (-e  "$lbpconfigdir/as_stopped.cfg") {
		LOGOK "Lox-Audioserver was stopped manually. Nothing to do.";
		return(0);
	}

	my $count = `sudo docker ps | grep -c Up.*lox-audioserver`;
	chomp ($count);
	if ($count eq "0") {
		LOGERR "Lox-Audioserver seems not to be running.";
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
		my $id = `sudo docker ps | grep Up.*lox-audioserver | awk '{ print \$1 }'`;
		chomp ($id);
		LOGOK "Lox-Audioserver is running. Fine. ID: $id";
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
