#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping ai-service (Docker)..."

cd "$PROJECT_DIR"
docker-compose stop ai-service

echo "ai-service stopped"
