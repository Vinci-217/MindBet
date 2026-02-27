#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting indexer-service (Docker)..."

cd "$PROJECT_DIR"
docker-compose up -d indexer-service

echo "indexer-service started"
