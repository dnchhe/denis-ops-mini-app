#!/bin/bash
set -euo pipefail
PLIST="$HOME/Library/LaunchAgents/com.denis.ops-miniapp.plist"
LABEL="com.denis.ops-miniapp"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"
launchctl print "gui/$(id -u)/$LABEL"
