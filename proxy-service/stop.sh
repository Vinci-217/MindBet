#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping proxy-service..."

pkill -f mihomo || pkill -f clash || echo "No proxy process found"

echo "proxy-service stopped"
