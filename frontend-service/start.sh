#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting frontend-service (Docker)..."

cd "$PROJECT_DIR"
docker-compose up -d frontend-service

echo "frontend-service started on port 80"
