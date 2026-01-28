#!/bin/bash

# Pauly Setup Script
# Configures a Mac for running Pauly 24/7

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "Pauly Setup"
echo "=========================================="
echo ""

# ==========================================
# 1. Check for Homebrew
# ==========================================
echo "[1/5] Checking Homebrew..."
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "Homebrew already installed."
fi

# ==========================================
# 2. Install required packages
# ==========================================
echo ""
echo "[2/5] Installing required packages..."
brew install msmtp 2>/dev/null || true

# ==========================================
# 3. Create directories
# ==========================================
echo ""
echo "[3/5] Creating directories..."
mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/cache/research"
mkdir -p "$HOME/.config/pauly"
echo "Done."

# ==========================================
# 4. Run configuration wizard
# ==========================================
echo ""
echo "[4/5] Configuration..."
source "$SCRIPT_DIR/lib/config.sh"

if ! config_exists || [ -z "$EMAIL" ]; then
    run_config_wizard
else
    echo "Configuration already exists."
    show_config
    echo ""
    read -p "Reconfigure? [y/N]: " reconfigure
    if [[ "$reconfigure" =~ ^[Yy] ]]; then
        run_config_wizard
    fi
fi

# ==========================================
# 5. Enable scheduled jobs
# ==========================================
echo ""
echo "[5/5] Enabling scheduled jobs..."

read -p "Enable all scheduled jobs? [Y/n]: " enable_jobs
if [[ ! "$enable_jobs" =~ ^[Nn] ]]; then
    "$SCRIPT_DIR/pauly" enable all
else
    echo "Skipped. Run 'pauly enable all' later to enable."
fi

# ==========================================
# Summary
# ==========================================
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Scheduled jobs (if enabled):"
echo "  • summary  - 5:00am daily"
echo "  • git      - 6:00am daily"
echo "  • research - 7:00am Mondays"
echo ""
echo "Commands:"
echo "  pauly status        # Check job status"
echo "  pauly run all       # Run all jobs now"
echo "  pauly test-email    # Test email delivery"
echo "  pauly enable all    # Enable all jobs"
echo "  pauly disable all   # Disable all jobs"
echo ""
echo "Add to PATH:"
echo "  sudo ln -sf $SCRIPT_DIR/pauly /usr/local/bin/pauly"
echo ""
