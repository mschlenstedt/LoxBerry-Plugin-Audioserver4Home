#!/usr/bin/perl

# Copyright 2024 Michael Schlenstedt, michael@loxberry.de
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


##########################################################################
# Modules
##########################################################################

# use Config::Simple '-strict';
# use CGI::Carp qw(fatalsToBrowser);
use CGI;
use LoxBerry::System;
use LoxBerry::Web;
use LoxBerry::JSON; # Available with LoxBerry 2.0
use LoxBerry::Log;
use warnings;
use strict;
#use Data::Dumper;

##########################################################################
# Variables
##########################################################################

my $log;

# Read Form
my $cgi = CGI->new;
my $q = $cgi->Vars;

my $version = LoxBerry::System::pluginversion();
my $template;
my $templatefile;
my $templateout;

# Language Phrases
my %L;

# Load config
my $cfgfile = "$lbpconfigdir/plugin.json";
my $jsonobj = LoxBerry::JSON->new();
my $cfg = $jsonobj->open(filename => $cfgfile, readonly => 1);

# Default is loxbuddy_settings form
$q->{form} = "playermanager" if !$q->{form};

if ($q->{form} eq "playermanager") {
	$templatefile = "$lbptemplatedir/playermanager.html";
	$template = LoxBerry::System::read_file($templatefile);
	&form_playermanager();
}
elsif ($q->{form} eq "audioserver") {
	$templatefile = "$lbptemplatedir/audioserver.html";
	$template = LoxBerry::System::read_file($templatefile);
	&form_audioserver();
}
elsif ($q->{form} eq "gateway") {
	$templatefile = "$lbptemplatedir/gateway.html";
	$template = LoxBerry::System::read_file($templatefile);
	&form_gateway();
}
elsif ($q->{form} eq "logs") {
	$templatefile = "$lbptemplatedir/log_settings.html";
	$template = LoxBerry::System::read_file($templatefile);
	&form_logs();
}
else {
	$templatefile = "$lbptemplatedir/playermanager.html";
	$template = LoxBerry::System::read_file($templatefile);
	&form_playermanager();
}

# Print the form out
&printtemplate();

exit;

##########################################################################
# Form: Playermanager
##########################################################################

sub form_playermanager
{
	# Prepare template
	&preparetemplate();

	return();
}

##########################################################################
# Form: Music Assistent
##########################################################################

sub form_audioserver
{
	# Prepare template
	&preparetemplate();

	return();
}

##########################################################################
# Form: Gateway
##########################################################################

sub form_gateway
{
	# Prepare template
	&preparetemplate();

	return();
}

##########################################################################
# Form: Log
##########################################################################

sub form_logs
{

	# Prepare template
	&preparetemplate();

	$templateout->param("LOGLIST", LoxBerry::Web::loglist_html());

	return();
}


###################
# Helper Section
###################

##########################################################################
# Check if TTS Plugin is installed
##########################################################################

sub is_tts_plugin_installed
{
	my ($plugin_id) = @_;

	return 0 if !$plugin_id;

	my @plugins = LoxBerry::System::get_plugins();
	return 0 if !@plugins;

	foreach my $plugin (@plugins) {
		next if !$plugin;

		if (defined $plugin->{PLUGINDB_FOLDER} && $plugin->{PLUGINDB_FOLDER} eq $plugin_id) {
			return 1;
		}

		if (defined $plugin->{PLUGINDB_NAME} && $plugin->{PLUGINDB_NAME} eq $plugin_id) {
			return 1;
		}
	}

	return 0;
}

##########################################################################
# Print Form
##########################################################################

sub preparetemplate
{

	# Add JS Scripts
	my $templatefile = "$lbptemplatedir/javascript.js";
	$template .= LoxBerry::System::read_file($templatefile);

	$templateout = HTML::Template->new_scalar_ref(
		\$template,
		global_vars => 1,
		loop_context_vars => 1,
		die_on_bad_params => 0,
	);

	# Language File
	%L = LoxBerry::System::readlanguage($templateout, "language.ini");

	# ajax.cgi is located in the html directory without authentication
	$templateout->param( AJAX_URL => "/plugins/$lbpplugindir/ajax.cgi" );

	# Url for AS WebUI Url
	my $asurl;
	if ( $cfg->{loxaudioserver}->{internal} ) {
		$asurl =  "http://" . LoxBerry::System::get_localip() . ":" . $cfg->{loxaudioserver}->{port};
	} else {
		$asurl =  "http://" . $cfg->{loxaudioserver}->{host} . ":" . $cfg->{loxaudioserver}->{port};
	}

	# Navbar
	our %navbar;

	$navbar{20}{Name} = "$L{'COMMON.LABEL_PLAYERMANAGER'}";
	$navbar{20}{URL} = 'index.cgi?form=playermanager';
	$navbar{20}{active} = 1 if $q->{form} eq "playermanager";

	$navbar{30}{Name} = "$L{'COMMON.LABEL_AUDIOSERVER'}";
	$navbar{30}{URL} = 'index.cgi?form=audioserver';
	$navbar{30}{active} = 1 if $q->{form} eq "audioserver";

	$navbar{40}{Name} = "$L{'COMMON.LABEL_GATEWAY'}";
	$navbar{40}{URL} = 'index.cgi?form=gateway';
	$navbar{40}{active} = 1 if $q->{form} eq "gateway";

	$navbar{60}{Name} = "$L{'COMMON.LABEL_AS_WEBUI'}";
	$navbar{60}{URL} = "$asurl";
	$navbar{60}{target} = '_blank';

	# Show Text2Speech navigation entry only if the Text2Speech plugin is installed
	if (&is_tts_plugin_installed("text2speech")) {
		my $text2speech_label = $L{'COMMON.LABEL_TEXT2SPEECH'} || "Text2Speech";

		$navbar{70}{Name} = "$text2speech_label";
		$navbar{70}{URL} = "http://loxberry-dev/admin/plugins/text2speech/";
		$navbar{70}{target} = "_blank";
	}
	
	$navbar{98}{Name} = "$L{'COMMON.LABEL_LOGS'}";
	$navbar{98}{URL} = 'index.cgi?form=logs';
	$navbar{98}{active} = 1 if $q->{form} eq "logs";

	return();
}

sub printtemplate
{

	# Print out Template
	LoxBerry::Web::lbheader($L{'COMMON.LABEL_PLUGINTITLE'} . " V$version", "https://wiki.loxberry.de/plugins/audioserver4home/start", "");
	# Print your plugins notifications with name daemon.
	print LoxBerry::Log::get_notifications_html($lbpplugindir, 'audioserver4home');
	print $templateout->output();
	LoxBerry::Web::lbfooter();
	
	return();

}