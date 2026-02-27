#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Starting contracts-service..."

cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm config set registry https://registry.npmmirror.com
    npm install
fi

echo "Compiling contracts..."
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
npx hardhat compile

echo "contracts-service started successfully!"
echo "Available commands:"
echo "  npx hardhat test              - Run tests"
echo "  npx hardhat run scripts/deploy.ts --network sepolia  - Deploy to Sepolia"
