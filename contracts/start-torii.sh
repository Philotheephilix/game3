#!/bin/bash

# Script to start Torii indexer for Dojo Heist Game
# Reads world address from manifest and starts Torii with proper configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${GREEN}=== Starting Torii Indexer ===${NC}"
echo -e "${BLUE}Contracts dir: $SCRIPT_DIR${NC}\n"

# Navigate to contracts directory
cd "$SCRIPT_DIR"

# Check if manifest exists
if [ ! -f "manifest_dev.json" ]; then
    echo -e "${RED}Error: manifest_dev.json not found${NC}"
    echo -e "${YELLOW}Please run 'sozo migrate --profile dev' first${NC}"
    exit 1
fi

# Extract world address from manifest
# Try multiple methods to extract world address
if command -v jq &> /dev/null; then
    WORLD_ADDRESS=$(jq -r '.world.address // empty' "manifest_dev.json")
else
    # Fallback: use grep (less reliable but works without jq)
    WORLD_ADDRESS=$(grep -A 2 '"world"' "manifest_dev.json" | grep '"address"' | head -1 | grep -o '"0x[^"]*"' | head -1 | tr -d '"')
fi

# If still empty, try the old method
if [ -z "$WORLD_ADDRESS" ]; then
    WORLD_ADDRESS=$(grep -o '"address": "0x[^"]*"' "manifest_dev.json" | head -1 | cut -d'"' -f4)
fi

if [ -z "$WORLD_ADDRESS" ]; then
    echo -e "${RED}Error: Could not extract world address from manifest${NC}"
    echo -e "${YELLOW}Please ensure contracts are migrated${NC}"
    exit 1
fi

echo -e "${GREEN}World Address: $WORLD_ADDRESS${NC}\n"

# Check if Katana is running
echo -e "${YELLOW}Checking if Katana is running...${NC}"
if ! curl -s http://localhost:5050 > /dev/null 2>&1; then
    echo -e "${RED}Error: Katana is not running${NC}"
    echo -e "${YELLOW}Please start Katana first:${NC}"
    echo -e "  katana --config katana.toml"
    exit 1
fi

echo -e "${GREEN}Katana is running${NC}\n"

# Check if Torii is already running
if pgrep -f "torii.*world.*$WORLD_ADDRESS" > /dev/null; then
    echo -e "${YELLOW}Torii appears to be already running for this world${NC}"
    echo -e "${YELLOW}Killing existing Torii process...${NC}"
    pkill -f "torii.*world.*$WORLD_ADDRESS" || true
    sleep 2
fi

# Check if port 8080 is in use
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}Port 8080 is already in use${NC}"
    echo -e "${YELLOW}Attempting to free port 8080...${NC}"
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start Torii
echo -e "${YELLOW}Starting Torii indexer...${NC}"
echo -e "${BLUE}Command:${NC}"
echo -e "  torii --world $WORLD_ADDRESS --rpc http://localhost:5050 --http.cors_origins \"*\""
echo -e "${YELLOW}Note: Torii auto-discovers models from the world contract${NC}"

# Start Torii in background and redirect output to log file
# Torii discovers models automatically from the world contract
# No --manifest flag needed (causes GLIBC issues on some systems)
torii \
    --world "$WORLD_ADDRESS" \
    --rpc http://localhost:5050 \
    --http.cors_origins "*" \
    > /tmp/torii.log 2>&1 &

TORII_PID=$!

echo -e "${GREEN}Torii started (PID: $TORII_PID)${NC}"

# Wait for Torii to be ready
echo -e "${YELLOW}Waiting for Torii to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}Torii is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Error: Torii failed to start${NC}"
        echo -e "${YELLOW}Check logs: cat /tmp/torii.log${NC}"
        cat /tmp/torii.log
        kill $TORII_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

echo -e "\n${GREEN}=== Torii Running ===${NC}"
echo -e "${BLUE}Services:${NC}"
echo -e "  Torii GraphQL:    https://api.cartridge.gg/x/harvest/torii/graphql"
echo -e "  Torii Health:     http://localhost:8080/health"
echo -e "  Katana RPC:       http://localhost:5050"
echo -e "\n${BLUE}World Address:${NC}"
echo -e "  $WORLD_ADDRESS"
echo -e "\n${BLUE}Logs:${NC}"
echo -e "  /tmp/torii.log"
echo -e "\n${BLUE}Process ID:${NC}"
echo -e "  $TORII_PID"
echo -e "\n${YELLOW}To stop Torii:${NC}"
echo -e "  kill $TORII_PID"
echo -e "  or: pkill -f 'torii.*world.*$WORLD_ADDRESS'"
echo -e "\n${GREEN}Torii is running in the background${NC}"
echo -e "${YELLOW}Press Ctrl+C to exit (Torii will continue running)${NC}\n"

# Keep script running to show logs (optional)
if [ "${1:-}" == "--follow-logs" ]; then
    echo -e "${BLUE}Following logs (Ctrl+C to stop):${NC}\n"
    tail -f /tmp/torii.log
fi

