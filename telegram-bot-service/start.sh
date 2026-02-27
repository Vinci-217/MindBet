#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting telegram-bot-service (Docker)..."

cd "$PROJECT_DIR"
docker-compose up -d telegram-bot-service

echo "telegram-bot-service started"
