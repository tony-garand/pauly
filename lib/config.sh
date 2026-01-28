#!/bin/bash

# Configuration management for Pauly CLI

CONFIG_FILE="$HOME/.config/pauly/config"
CONFIG_DIR="$HOME/.config/pauly"

# Default values
DEFAULT_EMAIL=""
DEFAULT_PROJECTS_DIR="$HOME/Projects"
DEFAULT_MAX_LOG_SIZE_MB=10
DEFAULT_MAX_LOG_FILES=5
DEFAULT_HEALTHCHECK_URL=""

# ==========================================
# Config File Management
# ==========================================

ensure_config_dir() {
    mkdir -p "$CONFIG_DIR"
}

load_config() {
    ensure_config_dir

    # Set defaults
    EMAIL="${DEFAULT_EMAIL}"
    PROJECTS_DIR="${DEFAULT_PROJECTS_DIR}"
    MAX_LOG_SIZE_MB="${DEFAULT_MAX_LOG_SIZE_MB}"
    MAX_LOG_FILES="${DEFAULT_MAX_LOG_FILES}"
    HEALTHCHECK_URL="${DEFAULT_HEALTHCHECK_URL}"

    # Load from file if exists
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
    fi
}

save_config() {
    ensure_config_dir

    cat > "$CONFIG_FILE" << EOF
# Pauly Configuration
# Generated: $(date)

# Email for notifications and alerts
EMAIL="$EMAIL"

# Directory to scan for git repos and projects
PROJECTS_DIR="$PROJECTS_DIR"

# Log rotation settings
MAX_LOG_SIZE_MB=$MAX_LOG_SIZE_MB
MAX_LOG_FILES=$MAX_LOG_FILES

# Healthchecks.io ping URL (optional)
HEALTHCHECK_URL="$HEALTHCHECK_URL"
EOF

    chmod 600 "$CONFIG_FILE"
}

config_exists() {
    [ -f "$CONFIG_FILE" ] && [ -s "$CONFIG_FILE" ]
}

get_config_value() {
    local key="$1"
    load_config
    eval echo "\$$key"
}

# ==========================================
# Interactive Prompts
# ==========================================

prompt_value() {
    local prompt="$1"
    local default="$2"
    local value=""

    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        echo "${value:-$default}"
    else
        read -p "$prompt: " value
        echo "$value"
    fi
}

prompt_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    local response=""

    if [ "$default" = "y" ]; then
        read -p "$prompt [Y/n]: " response
        response="${response:-y}"
    else
        read -p "$prompt [y/N]: " response
        response="${response:-n}"
    fi

    [[ "$response" =~ ^[Yy] ]]
}

run_config_wizard() {
    echo ""
    echo "Pauly Configuration"
    echo "==================="
    echo ""

    load_config

    # Email
    echo "Email address for notifications and alerts."
    EMAIL=$(prompt_value "Email" "$EMAIL")
    echo ""

    # Projects directory
    echo "Directory containing your git repositories."
    PROJECTS_DIR=$(prompt_value "Projects directory" "$PROJECTS_DIR")
    echo ""

    # Log settings
    if prompt_yes_no "Configure advanced settings?" "n"; then
        echo ""
        MAX_LOG_SIZE_MB=$(prompt_value "Max log size (MB)" "$MAX_LOG_SIZE_MB")
        MAX_LOG_FILES=$(prompt_value "Number of log files to keep" "$MAX_LOG_FILES")
        echo ""

        echo "Healthchecks.io URL for uptime monitoring (optional)."
        HEALTHCHECK_URL=$(prompt_value "Healthcheck URL" "$HEALTHCHECK_URL")
        echo ""
    fi

    # Save
    save_config

    echo ""
    echo "Configuration saved to $CONFIG_FILE"
    echo ""

    # Show summary
    echo "Current settings:"
    echo "  Email:        $EMAIL"
    echo "  Projects:     $PROJECTS_DIR"
    echo "  Log size:     ${MAX_LOG_SIZE_MB}MB"
    echo "  Log files:    $MAX_LOG_FILES"
    if [ -n "$HEALTHCHECK_URL" ]; then
        echo "  Healthcheck:  $HEALTHCHECK_URL"
    fi
    echo ""
}

show_config() {
    if ! config_exists; then
        echo "No configuration found. Run 'pauly config' to set up."
        return 1
    fi

    load_config

    echo "Configuration: $CONFIG_FILE"
    echo ""
    echo "  Email:        ${EMAIL:-<not set>}"
    echo "  Projects:     $PROJECTS_DIR"
    echo "  Log size:     ${MAX_LOG_SIZE_MB}MB"
    echo "  Log files:    $MAX_LOG_FILES"
    if [ -n "$HEALTHCHECK_URL" ]; then
        echo "  Healthcheck:  $HEALTHCHECK_URL"
    fi
}

# Load config on source
load_config
