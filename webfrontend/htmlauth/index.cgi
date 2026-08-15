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
	&open_text2speech_target();
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
# Get Text2Speech Web UI URL from AudioServer configuration
##########################################################################

sub get_text2speech_host
{
	my $json = LoxBerry::JSON->new();
	my $config = $json->open(
		filename => "$lbpdatadir/data/config.json",
		readonly => 1
	);
	return undef if !$config;

	my $provider = $config->{content}->{tts}->{provider};
	return undef if !$provider;
	return undef if ($provider->{type} // '') ne 'loxberry-tts';
	return undef if !$provider->{enabled};
	return undef if !defined $provider->{host} || $provider->{host} eq '';
	return $provider->{host};
}

##########################################################################
# Probe whether Text2Speech is installed on the configured remote LoxBerry
##########################################################################

sub probe_text2speech_installation
{
	my ($url) = @_;
	my $status = `curl -k -s -o /dev/null -w '%{http_code}' --connect-timeout 4 --max-time 8 "$url"`;
	return -1 if !$status || $status eq '000';
	return 0  if $status >= 400;
	return 1;
}

##########################################################################
# Read current Text2Speech ARCHIVEURL from release.cfg
##########################################################################

sub get_text2speech_release_archive_url
{
	my $api = "https://api.github.com/repos/Liver64/LoxBerry-TTS/releases/latest";

	my $release = `curl -k -sfL --max-time 10 -H 'Accept: application/vnd.github+json' -H 'User-Agent: LoxBerry-AudioServer4Home' "$api" 2>/dev/null`;
	return undef if !$release;

	my ($tag) = $release =~ /"tag_name"\s*:\s*"([^"]+)"/;
	return undef if !$tag;

	# Read release.cfg from the published release tag, never from master.
	my $release_cfg = `curl -k -sfL --max-time 10 "https://raw.githubusercontent.com/Liver64/LoxBerry-TTS/$tag/release.cfg" 2>/dev/null`;
	return undef if !$release_cfg;

	my ($archive_url) = $release_cfg =~ /^ARCHIVEURL=(.+)$/m;
	return undef if !$archive_url;

	$archive_url =~ s/\r$//;
	return $archive_url;
}

##########################################################################
# Open Text2Speech, or installer with prefilled release URL if it is missing
##########################################################################

sub open_text2speech_target
{
	my $host = &get_text2speech_host();

	if (!$host) {
		print $cgi->redirect('index.cgi');
		exit;
	}

	my $base_url   = "http://$host";
	my $plugin_url = "$base_url/admin/plugins/text2speech/";
	my $probe_url  = "$base_url/plugins/text2speech/index.php";

	my $installed = &probe_text2speech_installation($probe_url);
	if ($installed == 0) {
		my $archive_url = &get_text2speech_release_archive_url();
		if ($archive_url) {
			my $installer_url =
				"$base_url/admin/system/plugininstall.cgi?url=$archive_url";
			print $cgi->redirect($installer_url);
			exit;
		}
		print $cgi->redirect("$base_url/admin/system/plugininstall.cgi");
		exit;
	}
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

	# Show Text2Speech navigation entry only for an enabled external LoxBerry TTS provider.
	my $text2speech_host = &get_text2speech_host();
	if ($text2speech_host) {
		my $text2speech_label = $L{'COMMON.LABEL_TEXT2SPEECH'} || "Text2Speech";

		$navbar{70}{Name}   = "$text2speech_label";
		$navbar{70}{URL}    = 'index.cgi?action=open_text2speech';

		$navbar{70}{Name} = "$text2speech_label";
		$navbar{70}{URL} = "http://" . LoxBerry::System::get_localip() . ":" . LoxBerry::System::lbwebserverport() . "/admin/plugins/text2speech/";

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