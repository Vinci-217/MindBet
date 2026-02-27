#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "  MindBet - Stopping Services (Local)"
echo "========================================"

cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/logs/backend-api.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/logs/backend-api.pid")
    if kill -0 $PID 2>/dev/null; then
        echo "Stopping Backend API (PID: $PID)..."
        kill $PID 2>/dev/null || true
    fi
    rm -f "$SCRIPT_DIR/logs/backend-api.pid"
fi

if [ -f "$SCRIPT_DIR/logs/indexer.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/logs/indexer.pid")
    if kill -0 $PID 2>/dev/null; then
        echo "Stopping Indexer (PID: $PID)..."
        kill $PID 2>/dev/null || true
    fi
    rm -f "$SCRIPT_DIR/logs/indexer.pid"
fi

if [ -f "$SCRIPT_DIR/logs/frontend.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/logs/frontend.pid")
    if kill -0 $PID 2>/dev/null; then
        echo "Stopping Frontend (PID: $PID)..."
        kill $PID 2>/dev/null || true
    fi
    rm -f "$SCRIPT_DIR/logs/frontend.pid"
fi

echo ""
echo "Stopping Database Services (Docker)..."
docker-compose stop mysql redis

echo ""
echo "========================================"
echo "  All Services Stopped!"
echo "========================================"
echo ""
