#!/bin/bash

# Test runner for Pauly shell tests
# Requires: bats-core (brew install bats-core)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAULY_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "Pauly Shell Test Runner"
echo "======================="
echo ""

# Check for bats
if ! command -v bats &> /dev/null; then
    echo -e "${RED}Error: bats-core not installed${NC}"
    echo "Install with: brew install bats-core"
    exit 1
fi

# Make sure test helper is executable
chmod +x "$SCRIPT_DIR/test_helper/common.bash"

# Export PAULY_DIR for tests
export PAULY_DIR

# Run tests
echo "Running tests..."
echo ""

# Count test files
test_files=$(find "$SCRIPT_DIR" -name "*.bats" | wc -l | tr -d ' ')
echo "Found $test_files test file(s)"
echo ""

# Run bats with TAP output for CI compatibility
if [ "${CI:-}" = "true" ]; then
    bats --tap "$SCRIPT_DIR"
else
    bats "$SCRIPT_DIR"
fi

exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo -e "${RED}Some tests failed${NC}"
fi

exit $exit_code
