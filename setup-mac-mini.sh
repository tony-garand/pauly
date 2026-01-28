#!/bin/bash

# Mac Mini 24/7 AI Assistant Setup Script
# Run with: sudo ./setup-mac-mini.sh

set -e

echo "=========================================="
echo "Mac Mini 24/7 AI Assistant Setup"
echo "=========================================="
echo ""

# Check if running as root for system settings
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo for full setup:"
    echo "  sudo ./setup-mac-mini.sh"
    exit 1
fi

ACTUAL_USER="${SUDO_USER:-$USER}"
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)

echo "Setting up for user: $ACTUAL_USER"
echo ""

# ==========================================
# 1. Install Homebrew if needed
# ==========================================
echo "[1/8] Checking Homebrew..."
if ! sudo -u "$ACTUAL_USER" command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    sudo -u "$ACTUAL_USER" /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "Homebrew already installed."
fi

# ==========================================
# 2. Install required packages
# ==========================================
echo ""
echo "[2/8] Installing required packages..."
sudo -u "$ACTUAL_USER" brew install msmtp mailutils 2>/dev/null || true

# ==========================================
# 3. Configure power management
# ==========================================
echo ""
echo "[3/8] Configuring power management (prevent sleep, auto-restart)..."
pmset -a sleep 0
pmset -a disksleep 0
pmset -a displaysleep 0
pmset -a autorestart 1
pmset -a womp 1  # Wake on network access
echo "Power settings configured."

# ==========================================
# 4. Enable SSH remote access
# ==========================================
echo ""
echo "[4/8] Enabling SSH remote access..."
systemsetup -setremotelogin on 2>/dev/null || echo "SSH may already be enabled or requires manual setup in System Settings."

# ==========================================
# 5. Setup msmtp for Gmail
# ==========================================
echo ""
echo "[5/8] Setting up email configuration..."
MSMTP_CONFIG="$ACTUAL_HOME/.msmtprc"

if [ ! -f "$MSMTP_CONFIG" ]; then
    cat > "$MSMTP_CONFIG" << 'EOF'
# Gmail SMTP configuration
defaults
auth           on
tls            on
tls_trust_file /etc/ssl/cert.pem
logfile        ~/.msmtp.log

account        gmail
host           smtp.gmail.com
port           587
from           YOUR_EMAIL@gmail.com
user           YOUR_EMAIL@gmail.com
password       YOUR_APP_PASSWORD

account default : gmail
EOF
    chown "$ACTUAL_USER" "$MSMTP_CONFIG"
    chmod 600 "$MSMTP_CONFIG"
    echo "Created $MSMTP_CONFIG"
    echo ""
    echo "  ⚠️  IMPORTANT: Edit ~/.msmtprc with your Gmail credentials:"
    echo "     1. Replace YOUR_EMAIL@gmail.com with your email"
    echo "     2. Generate an App Password at: https://myaccount.google.com/apppasswords"
    echo "     3. Replace YOUR_APP_PASSWORD with the generated password"
else
    echo "msmtp config already exists at $MSMTP_CONFIG"
fi

# Configure mail to use msmtp
MAILRC="$ACTUAL_HOME/.mailrc"
if ! grep -q "msmtp" "$MAILRC" 2>/dev/null; then
    echo 'set sendmail="/opt/homebrew/bin/msmtp"' >> "$MAILRC"
    chown "$ACTUAL_USER" "$MAILRC"
    echo "Configured mail to use msmtp."
fi

# ==========================================
# 6. Create logs directory and install launchd jobs
# ==========================================
echo ""
echo "[6/8] Installing launchd jobs..."
LAUNCH_AGENTS_DIR="$ACTUAL_HOME/Library/LaunchAgents"
AI_ASSISTANT_DIR="$ACTUAL_HOME/Projects/ai-assistant"

mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$AI_ASSISTANT_DIR/logs"
mkdir -p "$AI_ASSISTANT_DIR/cache/research"
chown -R "$ACTUAL_USER" "$AI_ASSISTANT_DIR/logs" "$AI_ASSISTANT_DIR/cache"

# Install all plist files
for plist in claudesummary githealthcheck projectresearch; do
    PLIST_SOURCE="$AI_ASSISTANT_DIR/com.user.${plist}.plist"
    PLIST_DEST="$LAUNCH_AGENTS_DIR/com.user.${plist}.plist"

    if [ -f "$PLIST_SOURCE" ]; then
        cp "$PLIST_SOURCE" "$PLIST_DEST"
        chown "$ACTUAL_USER" "$PLIST_DEST"

        # Unload if already loaded, then load
        sudo -u "$ACTUAL_USER" launchctl unload "$PLIST_DEST" 2>/dev/null || true
        sudo -u "$ACTUAL_USER" launchctl load "$PLIST_DEST"
        echo "  ✓ $plist job installed"
    else
        echo "  ⚠ $PLIST_SOURCE not found"
    fi
done

# ==========================================
# 7. Install Tailscale for remote access
# ==========================================
echo ""
echo "[7/8] Installing Tailscale for secure remote access..."
if ! sudo -u "$ACTUAL_USER" command -v tailscale &> /dev/null; then
    sudo -u "$ACTUAL_USER" brew install --cask tailscale
    echo "Tailscale installed. Open the app to authenticate."
else
    echo "Tailscale already installed."
fi

# ==========================================
# 8. Setup healthcheck ping (optional)
# ==========================================
echo ""
echo "[8/8] Healthcheck configuration..."
HEALTHCHECK_URL=""
read -p "Enter Healthchecks.io ping URL (or press Enter to skip): " HEALTHCHECK_URL

if [ -n "$HEALTHCHECK_URL" ]; then
    # Add healthcheck ping to the daily summary script
    SUMMARY_SCRIPT="$ACTUAL_HOME/Projects/ai-assistant/daily-claude-summary.sh"
    if [ -f "$SUMMARY_SCRIPT" ] && ! grep -q "healthcheck" "$SUMMARY_SCRIPT"; then
        # Add healthcheck ping at the end of the script
        sed -i '' '/^echo "Daily summary completed/i\
# Ping healthcheck to confirm script ran\
curl -fsS -m 10 --retry 5 -o /dev/null '"$HEALTHCHECK_URL"' || true\
' "$SUMMARY_SCRIPT"
        echo "Healthcheck ping added to daily summary script."
    fi
else
    echo "Skipping healthcheck setup."
fi

# ==========================================
# Summary
# ==========================================
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "What's configured:"
echo "  ✓ Homebrew and required packages"
echo "  ✓ Power management (no sleep, auto-restart)"
echo "  ✓ SSH remote access enabled"
echo "  ✓ Email via msmtp (needs credentials in ~/.msmtprc)"
echo "  ✓ Tailscale for secure remote access"
echo ""
echo "Scheduled jobs:"
echo "  • Daily Claude summary     - 5:00am daily"
echo "  • Git health check         - 6:00am daily"
echo "  • Project research         - 7:00am Mondays (weekly)"
echo ""
echo "Features:"
echo "  • Automatic log rotation (10MB max, 5 files kept)"
echo "  • Failure alerts via email"
echo "  • Competitive analysis with caching"
echo ""
echo "Next steps:"
echo "  1. Edit ~/.msmtprc with your Gmail app password"
echo "  2. Open Tailscale app and authenticate"
echo "  3. Test email: echo 'test' | mail -s 'Test' anesthetics1@gmail.com"
echo "  4. Test scripts:"
echo "     $ACTUAL_HOME/Projects/ai-assistant/daily-claude-summary.sh"
echo "     $ACTUAL_HOME/Projects/ai-assistant/git-health-check.sh"
echo "     $ACTUAL_HOME/Projects/ai-assistant/project-research.sh"
echo ""
echo "To check launchd job status:"
echo "  launchctl list | grep 'com.user'"
echo ""
