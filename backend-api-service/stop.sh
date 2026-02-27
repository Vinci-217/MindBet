#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping backend-api-service (Docker)..."

cd "$PROJECT_DIR"
docker-compose stop backend-api-service

echo "backend-api-service stopped"
