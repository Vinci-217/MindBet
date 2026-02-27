#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting proxy-service..."

cd "$SCRIPT_DIR"

if [ -f "mihomo" ]; then
    ./mihomo -d . &
elif [ -f "clash" ]; then
    ./clash -d . &
else
    echo "No proxy binary found. Please configure manually."
    echo "You can download mihomo from: https://github.com/MetaCubeX/mihomo/releases"
fi

echo "proxy-service started."
