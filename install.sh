#!/bin/bash

# Pauly Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/tony-garand/pauly/main/install.sh | bash

set -e

INSTALL_DIR="${PAULY_INSTALL_DIR:-$HOME/.pauly}"
REPO_URL="https://github.com/tony-garand/pauly.git"

echo ""
echo "Installing Pauly..."
echo ""

# Check for git
if ! command -v git &> /dev/null; then
    echo "Error: git is required. Please install git first."
    exit 1
fi

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --quiet
else
    echo "Cloning repository..."
    git clone --quiet "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Make scripts executable
chmod +x pauly setup.sh
chmod +x *.sh 2>/dev/null || true

# Create symlink
echo ""
echo "Creating symlink..."

# Ensure /usr/local/bin exists
if [ ! -d /usr/local/bin ]; then
    echo "Creating /usr/local/bin..."
    sudo mkdir -p /usr/local/bin
fi

if [ -w /usr/local/bin ]; then
    ln -sf "$INSTALL_DIR/pauly" /usr/local/bin/pauly
    echo "Installed to /usr/local/bin/pauly"
else
    sudo ln -sf "$INSTALL_DIR/pauly" /usr/local/bin/pauly
    echo "Installed to /usr/local/bin/pauly (used sudo)"
fi

# Run setup
echo ""
exec "$INSTALL_DIR/setup.sh"
