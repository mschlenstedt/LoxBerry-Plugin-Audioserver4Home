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

# TTS PUBLIC-PROBE 4XX + RELEASE-TAG CFG - 2026-08-14
# Handle the Text2Speech navigation locally first. This makes it possible
# to verify the remote plugin before redirecting the browser.
if (defined $q->{action} && $q->{action} eq "open_text2speech") {
	&text2speech();
	exit;
}

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
# Open configured Text2Speech or offer installation if it is missing
##########################################################################

sub text2speech
{
	# Read configured TTS provider
	my $json = LoxBerry::JSON->new();
	my $config = $json->open(
		filename => "$lbpdatadir/data/config.json",
		readonly => 1
	);

	my $provider = $config->{content}->{tts}->{provider} if $config;

	if (
		!$provider
		|| ($provider->{type} // '') ne 'loxberry-tts'
		|| !$provider->{enabled}
		|| !$provider->{host}
	) {
		print $cgi->redirect('index.cgi');
		exit;
	}

	my $host       = $provider->{host};
	my $base_url   = "http://$host";
	my $plugin_url = "$base_url/admin/plugins/text2speech/";
	my $probe_url  = "$base_url/plugins/text2speech/index.php";

	# Check if Text2Speech is installed
	my $status = `curl -k -s -o /dev/null -w '%{http_code}' --connect-timeout 4 --max-time 8 "$probe_url"`;

	if ($status && $status ne '000' && $status >= 400) {

		# Get latest published Text2Speech release
		my $api = "https://api.github.com/repos/Liver64/LoxBerry-TTS/releases/latest";

		my $release = `curl -k -sfL --max-time 10 -H 'Accept: application/vnd.github+json' -H 'User-Agent: LoxBerry-AudioServer4Home' "$api" 2>/dev/null`;

		my ($tag) = $release =~ /"tag_name"\s*:\s*"([^"]+)"/ if $release;

		if ($tag) {
			# Read release.cfg from the published release tag
			my $release_cfg = `curl -k -sfL --max-time 10 "https://raw.githubusercontent.com/Liver64/LoxBerry-TTS/$tag/release.cfg" 2>/dev/null`;

			my ($archive_url) = $release_cfg =~ /^ARCHIVEURL=(.+)$/m if $release_cfg;

			if ($archive_url) {
				$archive_url =~ s/\r$//;

				print $cgi->redirect(
					"$base_url/admin/system/plugininstall.cgi?url=$archive_url"
				);
				exit;
			}
		}

		# Latest release could not be determined
		print $cgi->redirect("$base_url/admin/system/plugininstall.cgi");
		exit;
	}

	# Text2Speech is installed
	print $cgi->redirect($plugin_url);
	exit;
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

	$navbar{60}{Name} = "$L{'COMMON.LABEL_AS_WEBUI'}";
	$navbar{60}{URL} = "$asurl";
	$navbar{60}{target} = '_blank';

	# Show Text2Speech navigation entry only if an external TTS provider is configured.
	my $ttsjson = LoxBerry::JSON->new();
	my $ttsconfig = $ttsjson->open(
		filename => "$lbpdatadir/data/config.json",
		readonly => 1
	);
	my $ttsprovider = $ttsconfig->{content}->{tts}->{provider} if $ttsconfig;
	if (
		$ttsprovider
		&& ($ttsprovider->{type} // '') eq 'loxberry-tts'
		&& $ttsprovider->{enabled}
		&& $ttsprovider->{host}
	) {
		my $text2speech_label = $L{'COMMON.LABEL_TEXT2SPEECH'} || "Text2Speech";
		$navbar{70}{Name}   = $text2speech_label;
		$navbar{70}{URL}    = 'index.cgi?action=open_text2speech';
		$navbar{70}{target} = '_blank';
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