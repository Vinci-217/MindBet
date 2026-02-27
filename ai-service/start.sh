#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting ai-service (Docker)..."

cd "$PROJECT_DIR"
docker-compose up -d ai-service

echo "ai-service started on port 8003"
