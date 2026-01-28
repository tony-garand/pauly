#!/bin/bash

# Daily Claude Code Summary Script
# Runs at 5am, summarizes last 24 hours of activity, and emails the result

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Ensure mailutils is installed (requires Homebrew)
if ! command -v mail &> /dev/null; then
    log "mailutils not found. Attempting to install..."
    if command -v brew &> /dev/null; then
        brew install mailutils
    else
        log_error "Homebrew not found. Please install Homebrew first."
        exit 1
    fi
fi

do_summary() {
    log "Starting daily Claude summary"

    ensure_claude || return 1

    local summary=""

    # Run Claude Code to generate a summary of recent conversations
    summary=$(claude --print "Summarize all the work and conversations from the last 24 hours. Include:
    - Projects worked on
    - Files created or modified
    - Key decisions made
    - Tasks completed
    - Any pending items or follow-ups needed
    Be concise but comprehensive." 2>/dev/null)

    if [ -z "$summary" ]; then
        summary="No activity recorded in the last 24 hours."
    fi

    local full_report="Claude Code Daily Summary
Generated: $(date)
Period: Last 24 hours
========================================

$summary

========================================
End of Summary"

    # Send email
    send_email "Claude Code Daily Summary - $(date '+%Y-%m-%d')" "$full_report"

    log "Daily summary complete and emailed."
}

run_with_alerts "daily-summary" do_summary
