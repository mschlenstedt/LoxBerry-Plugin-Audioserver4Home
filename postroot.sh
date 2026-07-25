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

CONFIGDIR="$ARGV5/config/plugins/$ARGV3"
BINDIR="$ARGV5/bin/plugins/$ARGV3"

# Remove leftover containers before starting again. This has to cover both the
# current name (sonn-core) and the one used before the upstream project was
# renamed (lox-audioserver): an upgrade can start from either state, and a
# surviving container would block the host ports and the container name.
# The data lives in a bind mount, so removing the container is lossless.
docker rm -f sonn-core lox-audioserver > /dev/null 2>&1

# Restart AudioServer if it was running before installation
if [ -f "$CONFIGDIR/as_stopped_changed.cfg" ]; then
	echo "<INFO> Restarting AudioServer..."
	rm -f "$CONFIGDIR/as_stopped.cfg"
	su -s /bin/bash loxberry -c "perl $BINDIR/as_watchdog.pl --action=start"
	rm -f "$CONFIGDIR/as_stopped_changed.cfg"
	echo "<OK> AudioServer restarted."
fi

# Restart MQTT Gateway if it was running before installation
if [ -f "$CONFIGDIR/gw_stopped_changed.cfg" ]; then
	echo "<INFO> Restarting MQTT Gateway..."
	rm -f "$CONFIGDIR/gw_stopped.cfg"
	su -s /bin/bash loxberry -c "perl $BINDIR/gw_watchdog.pl --action=start"
	rm -f "$CONFIGDIR/gw_stopped_changed.cfg"
	echo "<OK> MQTT Gateway restarted."
fi

# Exit with Status 0
exit 0
