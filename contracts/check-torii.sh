#!/bin/bash

# Script to check Torii status and health

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Torii Status Check ===${NC}\n"

# Check if Torii process is running
TORII_PIDS=$(pgrep -f "torii.*world" || true)

if [ -z "$TORII_PIDS" ]; then
    echo -e "${RED}✗ Torii is not running${NC}"
else
    echo -e "${GREEN}✓ Torii is running${NC}"
    echo -e "${BLUE}  Process IDs:${NC}"
    for PID in $TORII_PIDS; do
        echo -e "    - PID: $PID"
    done
fi

echo ""

# Check if port 8080 is listening
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Port 8080 is in use${NC}"
    LSOF_OUTPUT=$(lsof -Pi :8080 -sTCP:LISTEN)
    echo -e "${BLUE}  Details:${NC}"
    echo "$LSOF_OUTPUT" | tail -1 | awk '{print "    - " $1 " (PID: " $2 ")"}'
else
    echo -e "${RED}✗ Port 8080 is not in use${NC}"
fi

echo ""

# Check GraphQL endpoint
echo -e "${YELLOW}Testing GraphQL endpoint...${NC}"
if curl -s -X POST https://api.cartridge.gg/x/harvest/torii/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ __typename }"}' \
    > /dev/null 2>&1; then
    echo -e "${GREEN}✓ GraphQL endpoint is responding${NC}"
else
    echo -e "${RED}✗ GraphQL endpoint is not responding${NC}"
fi

echo ""

# Check health endpoint (if available)
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health endpoint is responding${NC}"
    HEALTH=$(curl -s http://localhost:8080/health)
    echo -e "${BLUE}  Health: $HEALTH${NC}"
else
    echo -e "${YELLOW}⚠ Health endpoint not available${NC}"
fi

echo ""

# Show log file info
if [ -f "/tmp/torii.log" ]; then
    LOG_SIZE=$(wc -l < /tmp/torii.log)
    echo -e "${BLUE}Log file:${NC}"
    echo -e "  Path: /tmp/torii.log"
    echo -e "  Lines: $LOG_SIZE"
    echo -e "  Last 5 lines:"
    tail -5 /tmp/torii.log | sed 's/^/    /'
else
    echo -e "${YELLOW}⚠ Log file not found: /tmp/torii.log${NC}"
fi

echo ""

# Get world address if manifest exists
if [ -f "manifest_dev.json" ]; then
    if command -v jq &> /dev/null; then
        WORLD_ADDRESS=$(jq -r '.world.address // empty' "manifest_dev.json" 2>/dev/null || echo "")
    else
        WORLD_ADDRESS=$(grep -A 2 '"world"' "manifest_dev.json" | grep '"address"' | head -1 | grep -o '"0x[^"]*"' | head -1 | tr -d '"' || echo "")
    fi
    
    if [ ! -z "$WORLD_ADDRESS" ]; then
        echo -e "${BLUE}World Address:${NC}"
        echo -e "  $WORLD_ADDRESS"
    fi
fi

echo ""

# Summary
if [ ! -z "$TORII_PIDS" ] && lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}=== Torii Status: RUNNING ===${NC}"
    echo -e "\n${BLUE}Available endpoints:${NC}"
    echo -e "  GraphQL:  https://api.cartridge.gg/x/harvest/torii/graphql"
    echo -e "  Health:   http://localhost:8080/health"
else
    echo -e "${RED}=== Torii Status: NOT RUNNING ===${NC}"
    echo -e "\n${YELLOW}To start Torii:${NC}"
    echo -e "  ./start-torii.sh"
fi



