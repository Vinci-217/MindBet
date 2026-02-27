#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping telegram-bot-service (Docker)..."

cd "$PROJECT_DIR"
docker-compose stop telegram-bot-service

echo "telegram-bot-service stopped"
