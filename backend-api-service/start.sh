#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting backend-api-service (Docker)..."

cd "$PROJECT_DIR"
docker-compose up -d backend-api-service

echo "backend-api-service started on port 8080"
