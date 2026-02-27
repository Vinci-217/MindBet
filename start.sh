#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "  MindBet - Starting Services (Local)"
echo "========================================"

cd "$SCRIPT_DIR"

if [ ! -f ".env" ]; then
    echo "Error: .env file not found"
    exit 1
fi

source .env

echo ""
echo "Starting Database Services (Docker)..."
docker-compose up -d mysql redis

echo ""
echo "Waiting for database to be ready..."
sleep 5

echo ""
echo "Starting Backend API Service (Local)..."
cd "$SCRIPT_DIR/backend-api-service"
go mod tidy
go build -o mindbet-api ./cmd/main.go
nohup ./mindbet-api > "$SCRIPT_DIR/logs/backend-api.log" 2>&1 &
echo $! > "$SCRIPT_DIR/logs/backend-api.pid"
echo "Backend API started (PID: $(cat $SCRIPT_DIR/logs/backend-api.pid))"

echo ""
echo "Starting Indexer Service (Local)..."
cd "$SCRIPT_DIR/indexer-service"
go mod tidy
go build -o mindbet-indexer ./cmd/main.go
nohup ./mindbet-indexer > "$SCRIPT_DIR/logs/indexer.log" 2>&1 &
echo $! > "$SCRIPT_DIR/logs/indexer.pid"
echo "Indexer started (PID: $(cat $SCRIPT_DIR/logs/indexer.pid))"

echo ""
echo "Starting Frontend Service (Local)..."
cd "$SCRIPT_DIR/frontend-service"
npm install
PORT=80 nohup npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
echo $! > "$SCRIPT_DIR/logs/frontend.pid"
echo "Frontend started (PID: $(cat $SCRIPT_DIR/logs/frontend.pid))"

echo ""
echo "========================================"
echo "  All Services Started!"
echo "========================================"
echo ""
echo "Service URLs:"
echo "  - Frontend:      http://localhost"
echo "  - Backend API:   http://localhost:8080"
echo "  - MySQL:         localhost:13306"
echo "  - Redis:         localhost:6379"
echo ""
echo "Logs directory: $SCRIPT_DIR/logs/"
echo "To stop: ./stop.sh"
echo ""
