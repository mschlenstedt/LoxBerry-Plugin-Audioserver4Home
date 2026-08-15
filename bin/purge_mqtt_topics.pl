#!/usr/bin/perl

# purge_mqtt_topics.pl - clear the retained topics of the removed MQTT gateway
#
# Up to v3.1.0 the plugin published everything retained below its own base topic
# (default "audioserver4home"). Since v3.2.0 the AudioServer publishes to the
# broker itself and the gateway is gone - but the old retained values stay in
# the broker forever, so the Finder and the Miniserver keep serving numbers that
# nothing refreshes any more.
#
# Run once from postupgrade.sh. Every failure is silent and non-fatal: the worst
# case is a few stale topics, which is exactly the situation without this script.
#
# Usage: purge_mqtt_topics.pl [--basetopic=<topic>]
#        Without an argument the base topic is read from plugin.json (the old
#        mqtt section, which the upgrade restores before this runs).

use strict;
use warnings;
use LoxBerry::System;
use LoxBerry::JSON;
use LoxBerry::Log;

my $basetopic;
for my $arg (@ARGV) {
	$basetopic = $1 if $arg =~ /^--basetopic=(.+)$/;
}

if ( !$basetopic ) {
	my $cfg = eval {
		my $o = LoxBerry::JSON->new();
		$o->open( filename => "$lbpconfigdir/plugin.json", readonly => 1 );
	};
	$basetopic = $cfg->{mqtt}->{basetopic} if $cfg && $cfg->{mqtt};
}

# Nothing configured (fresh install, or already cleaned up) - nothing to do.
exit 0 if !$basetopic;

# Guard against wiping the whole broker if the config ever holds something odd.
exit 0 if $basetopic =~ m{^[/#+\s]*$} || $basetopic =~ m{[#+]};

my $log = LoxBerry::Log->new(
	name    => 'purge_mqtt_topics',
	package => $lbpplugindir,
	addtime => 1,
);
$log->LOGSTART("Clearing retained topics below $basetopic");

eval {
	require LoxBerry::IO;
	require Net::MQTT::Simple;

	my $cred = LoxBerry::IO::mqtt_connectiondetails();
	if ( !defined $cred ) {
		LOGINF("MQTT Gateway plugin not installed - nothing to clear.");
		$log->LOGEND();
		exit 0;
	}

	$ENV{MQTT_SIMPLE_ALLOW_INSECURE_LOGIN} = 1;
	my $mqtt = Net::MQTT::Simple->new( $cred->{brokeraddress} );
	if ( !$mqtt ) {
		LOGWARN("Could not connect to the broker - nothing cleared.");
		$log->LOGEND();
		exit 0;
	}
	$mqtt->login( $cred->{brokeruser}, $cred->{brokerpass} ) if $cred->{brokeruser};

	# Collect the retained topics the broker replays on subscribe. They arrive
	# in one burst, so a short window is enough.
	my %topics;
	$mqtt->subscribe( "$basetopic/#", sub { $topics{ $_[0] } = 1; } );

	my $deadline = time + 3;
	$mqtt->tick(1) while time < $deadline;

	$mqtt->unsubscribe("$basetopic/#");

	# An empty retained payload deletes the retained message.
	for my $topic ( sort keys %topics ) {
		$mqtt->retain( $topic, '' );
	}

	LOGOK( scalar( keys %topics ) . " retained topics cleared below $basetopic." );
	$mqtt->disconnect();
};
if ($@) {
	LOGWARN("Could not clear the old topics: $@");
}

$log->LOGEND();
exit 0;
