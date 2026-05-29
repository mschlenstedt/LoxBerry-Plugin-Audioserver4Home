#!/bin/bash

# We add 5 arguments when executing the script:
# command <TEMPFOLDER> <NAME> <FOLDER> <VERSION> <BASEFOLDER>
#
# For logging, print to STDOUT. You can use the following tags for showing
# different colorized information during plugin installation:
#
# <OK> This was ok!"
# <INFO> This is just for your information."
# <WARNING> This is a warning!"
# <ERROR> This is an error!"
# <FAIL> This is a fail!"

# To use important variables from command line use the following code:
ARGV0=$0 # Zero argument is shell command
ARGV1=$1 # First argument is temp folder during install
ARGV2=$2 # Second argument is Plugin-Name for scipts etc.
ARGV3=$3 # Third argument is Plugin installation folder
ARGV4=$4 # Forth argument is Plugin version
ARGV5=$5 # Fifth argument is Base folder of LoxBerry

pluginname=$3

# Install the php-gd extension if it is missing. cover.php needs GD
# (imagecreatefromstring/imagescale/imagepng/...). We do this here in its own
# apt call - NOT bundled in dpkg/apt - so a missing/unavailable package can
# never abort the whole install (e.g. Docker).
#
# We ONLY install the package matching the PHP version that is actually running
# (php${ver}-gd) with --no-install-recommends. We deliberately do NOT fall back
# to the virtual "php-gd": on a system whose active PHP differs from the distro
# default (e.g. LoxBerry running PHP 7.4 on Bookworm, whose default is 8.2),
# "php-gd" would pull a different PHP major.minor and drag its whole package set
# in - useless for cover.php and a risky side effect. If the matching package is
# unavailable we just warn; cover.php has a no-GD path that serves unresized
# images, so a missing extension never breaks the plugin install.
if ! php -r "exit(extension_loaded('gd') ? 0 : 1);" 2>/dev/null; then
	phpver=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null)
	if [ -n "$phpver" ]; then
		echo "<INFO> Installing php${phpver}-gd..."
		if apt-get install -y --no-install-recommends "php${phpver}-gd" 2>/dev/null; then
			echo "<OK> php${phpver}-gd installed."
		else
			echo "<WARNING> php${phpver}-gd not available - cover.php will serve unresized images."
		fi
	else
		echo "<WARNING> Could not determine PHP version - skipping php-gd; cover.php will serve unresized images."
	fi
fi

# Install docker on next reboot
which docker > /dev/null
if [ $? -ne 0 ]; then
	echo "<INFO> Preparing Docker Installation..."
	curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
	chmod a+r /etc/apt/keyrings/docker.asc
	# Add the repository to Apt sources:
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
	echo "<OK> Added Docker to apt as Repository."
else
	echo "<OK> Seems that Docker is already installed. Do nothing."
fi

# Stop services before chown (only on upgrade, skipped silently on first install)
CONFIGDIR="$ARGV5/config/plugins/$ARGV3"

# Stop Lox-Audioserver
if [ ! -f "$CONFIGDIR/as_stopped.cfg" ]; then
	touch "$CONFIGDIR/as_stopped.cfg"
	touch "$CONFIGDIR/as_stopped_changed.cfg"
fi
echo "<INFO> Stopping Lox-Audioserver..."
sudo docker compose -f "$CONFIGDIR/docker-compose.yml" down 2>/dev/null
echo "<OK> Lox-Audioserver stopped."

# Stop MQTT Gateway
if [ ! -f "$CONFIGDIR/gw_stopped.cfg" ]; then
	touch "$CONFIGDIR/gw_stopped.cfg"
	touch "$CONFIGDIR/gw_stopped_changed.cfg"
fi
echo "<INFO> Stopping MQTT Gateway..."
pkill -f "loxaudioserver_mqtt.pl" 2>/dev/null
echo "<OK> MQTT Gateway stopped."

# Chown data and config folders
echo "<INFO> Correcting Ownership of Data Folder..."
chown -R loxberry:loxberry $ARGV5/data/plugins/$ARGV3/*
chown -R loxberry:loxberry $ARGV5/config/plugins/$ARGV3/*

# Exit with Status 0
exit 0
