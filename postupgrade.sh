#!/bin/sh

ARGV0=$0 # Zero argument is shell command
ARGV1=$1 # First argument is temp folder during install
ARGV2=$2 # Second argument is Plugin-Name for scipts etc.
ARGV3=$3 # Third argument is Plugin installation folder
ARGV4=$4 # Forth argument is Plugin version
ARGV5=$5 # Fifth argument is Base folder of LoxBerry

echo "<INFO> Copy back existing config files"
cp -p -v -r /tmp/$ARGV1\_upgrade/config/$ARGV3/* $ARGV5/config/plugins/$ARGV3/ 

echo "<INFO> Copy back existing log files"
cp -p -v -r /tmp/$ARGV1\_upgrade/log/$ARGV3/* $ARGV5/log/plugins/$ARGV3/ 

echo "<INFO> Copy back existing data files"
cp -p -v -r /tmp/$ARGV1\_upgrade/data/$ARGV3/* $ARGV5/data/plugins/$ARGV3/

echo "<INFO> Remove temporary folders"
rm -r /tmp/$ARGV1\_upgrade

# The upstream project was renamed: lox-audioserver -> sonn core. GitHub
# redirects the repository, but the GitHub Container Registry does not - the old
# package ghcr.io/lox-audioserver/lox-audioserver is frozen at 4.0.0-beta.16.
# The user's docker-compose.yml was just restored above, so it has to be
# migrated here (in place, to keep manual edits like the "devices:" section).
COMPOSE="$ARGV5/config/plugins/$ARGV3/docker-compose.yml"
if [ -f "$COMPOSE" ] && grep -q "ghcr.io/lox-audioserver/lox-audioserver" "$COMPOSE"; then
	echo "<INFO> Migrating docker-compose.yml to sonn core (ghcr.io/sonn-audio/core)..."
	TAG=`sed -n 's|^[[:space:]]*image:[[:space:]]*ghcr.io/lox-audioserver/lox-audioserver:\(.*\)$|\1|p' "$COMPOSE" | head -n1`
	case "$TAG" in
		beta|beta-latest|dev|dev-latest|testing|testing-latest|latest)
			# Rolling channels exist in the new package as well - keep the choice
			NEWTAG="$TAG"
			;;
		*)
			# Pinned versions (4.0.0-beta.16 and older) do not exist in the new
			# package. Keeping them would break the pull, so move to the channel.
			NEWTAG="beta-latest"
			;;
	esac
	sed -i \
		-e "s|ghcr.io/lox-audioserver/lox-audioserver:.*|ghcr.io/sonn-audio/core:$NEWTAG|" \
		-e "s|^\([[:space:]]*\)loxoneaudioserver:|\1sonn-core:|" \
		-e "s|^\([[:space:]]*\)container_name:.*|\1container_name: sonn-core|" \
		-e "s|^\([[:space:]]*\)hostname:.*|\1hostname: sonn-core|" \
		"$COMPOSE"
	echo "<OK> docker-compose.yml migrated (image: ghcr.io/sonn-audio/core:$NEWTAG, container: sonn-core)."
	if [ "$NEWTAG" != "$TAG" ]; then
		echo "<INFO> Version $TAG is not available in the new package – switched to channel $NEWTAG."
	fi
fi

# The plugin's own MQTT gateway was removed in v3.3.0 - the AudioServer
# publishes to the broker itself now. Its retained topics would otherwise stay
# in the broker forever, serving values that nothing refreshes. This reads the
# old base topic from the config restored above, so it has to run before the
# "mqtt" section is ever dropped from plugin.json.
if [ -x "$ARGV5/bin/plugins/$ARGV3/purge_mqtt_topics.pl" ]; then
	echo "<INFO> Clearing retained topics of the removed MQTT Gateway..."
	"$ARGV5/bin/plugins/$ARGV3/purge_mqtt_topics.pl" > /dev/null 2>&1
	echo "<OK> Old MQTT topics cleared (see the plugin log for details)."
fi

# Exit with Status 0
exit 0
