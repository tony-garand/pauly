#!/bin/bash

# Common functions for AI Assistant scripts
# Source this file: source "$(dirname "$0")/lib/common.sh"

# Configuration
EMAIL="anesthetics1@gmail.com"
PROJECT_DIR="$HOME/Projects/ai-assistant"
LOG_DIR="$PROJECT_DIR/logs"
MAX_LOG_SIZE_MB=10
MAX_LOG_FILES=5

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# ==========================================
# Logging Functions
# ==========================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# ==========================================
# Log Rotation
# ==========================================

rotate_log() {
    local log_file="$1"
    local max_size_bytes=$((MAX_LOG_SIZE_MB * 1024 * 1024))

    if [ -f "$log_file" ]; then
        local size=$(stat -f%z "$log_file" 2>/dev/null || echo 0)

        if [ "$size" -gt "$max_size_bytes" ]; then
            # Rotate existing logs
            for i in $(seq $((MAX_LOG_FILES - 1)) -1 1); do
                if [ -f "${log_file}.$i" ]; then
                    mv "${log_file}.$i" "${log_file}.$((i + 1))"
                fi
            done

            # Compress and rotate current log
            mv "$log_file" "${log_file}.1"
            gzip -f "${log_file}.1" 2>/dev/null || true

            log "Rotated log: $log_file"
        fi
    fi
}

rotate_all_logs() {
    for log_file in "$LOG_DIR"/*.log; do
        [ -f "$log_file" ] && rotate_log "$log_file"
    done
}

# ==========================================
# Email Functions
# ==========================================

send_email() {
    local subject="$1"
    local body="$2"
    local priority="${3:-normal}"  # normal or high

    if command -v mail &> /dev/null; then
        if [ "$priority" = "high" ]; then
            echo "$body" | mail -s "🚨 $subject" "$EMAIL"
        else
            echo "$body" | mail -s "$subject" "$EMAIL"
        fi
        return 0
    else
        log_error "mail command not found"
        return 1
    fi
}

send_failure_alert() {
    local script_name="$1"
    local error_message="$2"
    local log_tail="${3:-}"

    local body="Script Failed: $script_name
Time: $(date)
Host: $(hostname)

Error:
$error_message

"
    if [ -n "$log_tail" ]; then
        body+="Recent Log Output:
$log_tail"
    fi

    send_email "AI Assistant Failure: $script_name" "$body" "high"
}

# ==========================================
# Script Wrapper with Error Handling
# ==========================================

# Use this to wrap your main script logic
# Example: run_with_alerts "my-script" main_function
run_with_alerts() {
    local script_name="$1"
    local main_function="$2"
    local log_file="$LOG_DIR/${script_name}.log"

    # Rotate logs before running
    rotate_log "$log_file"

    # Run the main function and capture output
    {
        if $main_function; then
            log "Script completed successfully: $script_name"

            # Ping healthcheck if configured
            if [ -n "${HEALTHCHECK_URL:-}" ]; then
                curl -fsS -m 10 --retry 5 -o /dev/null "$HEALTHCHECK_URL" || true
            fi
        else
            local exit_code=$?
            log_error "Script failed with exit code $exit_code: $script_name"

            # Get last 50 lines of log for the alert
            local log_tail=""
            if [ -f "$log_file" ]; then
                log_tail=$(tail -50 "$log_file")
            fi

            send_failure_alert "$script_name" "Exit code: $exit_code" "$log_tail"

            # Ping healthcheck failure endpoint if configured
            if [ -n "${HEALTHCHECK_URL:-}" ]; then
                curl -fsS -m 10 --retry 5 -o /dev/null "$HEALTHCHECK_URL/fail" || true
            fi

            return $exit_code
        fi
    } 2>&1 | tee -a "$log_file"
}

# ==========================================
# Utility Functions
# ==========================================

ensure_homebrew() {
    if ! command -v brew &> /dev/null; then
        log_error "Homebrew not found"
        return 1
    fi
}

ensure_claude() {
    if ! command -v claude &> /dev/null; then
        log_error "Claude CLI not found"
        return 1
    fi
}
