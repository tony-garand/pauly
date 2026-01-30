#!/bin/bash

# Ensure Dev Running
# Checks all projects for unfinished tasks and starts pauly dev if not running

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/config.sh" 2>/dev/null || true
source "$SCRIPT_DIR/lib/common.sh" 2>/dev/null || true

PROJECTS_DIR="${PROJECTS_DIR:-$HOME/Projects}"
LOG_FILE="$SCRIPT_DIR/logs/ensure-dev.log"
PAULY_PATH="$SCRIPT_DIR/pauly"

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> "$LOG_FILE"
}

# Check if pauly dev is running for a specific project
is_dev_running() {
    local project_path="$1"
    pgrep -f "pauly dev.*$project_path" > /dev/null 2>&1
}

# Count unchecked tasks in TASKS.md
count_unchecked_tasks() {
    local tasks_file="$1"
    if [[ -f "$tasks_file" ]]; then
        local count
        count=$(grep -c '^\s*- \[ \]' "$tasks_file" 2>/dev/null || echo "0")
        # Clean up the count (remove any non-numeric chars)
        count="${count//[^0-9]/}"
        [[ -z "$count" ]] && count=0
        echo "$count"
    else
        echo "0"
    fi
}

# Main check
main() {
    log "Starting dev process check..."

    if [[ ! -d "$PROJECTS_DIR" ]]; then
        log "Projects directory not found: $PROJECTS_DIR"
        exit 0
    fi

    local started=0
    local already_running=0
    local no_tasks=0

    for project_dir in "$PROJECTS_DIR"/*/; do
        [[ ! -d "$project_dir" ]] && continue

        local project_name=$(basename "$project_dir")
        local tasks_file="$project_dir/TASKS.md"

        # Skip hidden directories
        [[ "$project_name" == .* ]] && continue

        local unchecked=$(count_unchecked_tasks "$tasks_file")

        if [[ "$unchecked" -gt 0 ]]; then
            if is_dev_running "$project_dir"; then
                log "$project_name: dev running ($unchecked tasks remaining)"
                ((already_running++))
            else
                log "$project_name: starting dev ($unchecked unchecked tasks)"

                # Start pauly dev in background with logging
                local dev_log="$SCRIPT_DIR/logs/dev-${project_name}.log"
                (
                    cd "$project_dir"
                    "$PAULY_PATH" dev >> "$dev_log" 2>&1
                ) &
                disown

                ((started++))

                # Small delay to avoid overwhelming the system
                sleep 2
            fi
        else
            ((no_tasks++))
        fi
    done

    log "Check complete: started=$started, already_running=$already_running, no_tasks=$no_tasks"

    if [[ $started -gt 0 ]]; then
        echo "Started pauly dev for $started project(s)"
    fi
}

main "$@"
