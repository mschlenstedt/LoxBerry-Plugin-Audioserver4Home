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
