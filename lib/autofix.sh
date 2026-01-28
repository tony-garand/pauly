#!/bin/bash

# Auto-fix module for Pauly CLI
# Analyzes job failures and creates PRs with fixes

# Get the directory where this script lives
AUTOFIX_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOFIX_PAULY_DIR="$(dirname "$AUTOFIX_LIB_DIR")"
AUTOFIX_LOG_DIR="$AUTOFIX_PAULY_DIR/logs/autofix"
AUTOFIX_LOCK_FILE="$AUTOFIX_PAULY_DIR/logs/.autofix.lock"
AUTOFIX_LOCK_TIMEOUT=1800  # 30 minutes in seconds

# Ensure autofix log directory exists
mkdir -p "$AUTOFIX_LOG_DIR"

# ==========================================
# Lock Management (Prevent Infinite Loops)
# ==========================================

autofix_acquire_lock() {
    local now=$(date +%s)

    # Check if lock file exists
    if [ -f "$AUTOFIX_LOCK_FILE" ]; then
        local lock_time=$(cat "$AUTOFIX_LOCK_FILE" 2>/dev/null || echo "0")
        local age=$((now - lock_time))

        # If lock is older than timeout, it's stale - remove it
        if [ "$age" -gt "$AUTOFIX_LOCK_TIMEOUT" ]; then
            autofix_log "Removing stale lock file (age: ${age}s)"
            rm -f "$AUTOFIX_LOCK_FILE"
        else
            autofix_log "Lock file exists and is fresh (age: ${age}s) - skipping auto-fix"
            return 1
        fi
    fi

    # Create lock file with current timestamp
    echo "$now" > "$AUTOFIX_LOCK_FILE"
    autofix_log "Acquired lock"
    return 0
}

autofix_release_lock() {
    if [ -f "$AUTOFIX_LOCK_FILE" ]; then
        rm -f "$AUTOFIX_LOCK_FILE"
        autofix_log "Released lock"
    fi
}

# ==========================================
# Logging
# ==========================================

autofix_log() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" >> "$AUTOFIX_LOG_DIR/autofix.log"
}

autofix_log_error() {
    local message="$1"
    autofix_log "ERROR: $message"
}

# ==========================================
# Eligibility Check
# ==========================================

autofix_is_eligible() {
    local script_name="$1"

    # Check if auto-fix is enabled
    if [ "${AUTOFIX_ENABLED:-false}" != "true" ]; then
        autofix_log "Auto-fix is disabled"
        return 1
    fi

    # Check if this script is in the allowed list
    if [ "${AUTOFIX_SCRIPTS:-all}" != "all" ]; then
        if ! echo "$AUTOFIX_SCRIPTS" | grep -q "$script_name"; then
            autofix_log "Script '$script_name' not in allowed list: $AUTOFIX_SCRIPTS"
            return 1
        fi
    fi

    # Check if claude CLI is available
    if ! command -v claude &> /dev/null; then
        autofix_log "Claude CLI not found - cannot analyze error"
        return 1
    fi

    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        autofix_log "GitHub CLI (gh) not found - cannot create PR"
        return 1
    fi

    # Check if we're in a git repo
    if ! git -C "$AUTOFIX_PAULY_DIR" rev-parse --git-dir &> /dev/null; then
        autofix_log "Not in a git repository - cannot create PR"
        return 1
    fi

    return 0
}

# ==========================================
# Error Analysis
# ==========================================

analyze_error() {
    local script_name="$1"
    local error_message="$2"
    local log_tail="$3"
    local analysis_file="$AUTOFIX_LOG_DIR/analysis-$(date +%Y%m%d-%H%M%S).txt"

    autofix_log "Analyzing error for $script_name"

    # Build the analysis prompt
    local prompt="You are analyzing a failure in a bash script that is part of the Pauly CLI tool.

SCRIPT: $script_name
ERROR: $error_message

RECENT LOG OUTPUT:
$log_tail

TASK: Analyze this error and determine if it's a bug in the Pauly code that can be fixed.

Respond in this EXACT format (no other text):
FIXABLE: yes OR FIXABLE: no
REASON: <one line explanation>
FILE: <path to file that needs fixing, relative to repo root, or 'none'>
DESCRIPTION: <brief description of the fix needed>

Rules:
- Only say FIXABLE: yes if this is clearly a CODE BUG in pauly's bash scripts
- Say FIXABLE: no for: external service errors, network issues, missing dependencies, configuration problems, permission issues
- If multiple files need fixing, list the primary one
- Be conservative - if unsure, say FIXABLE: no"

    # Run Claude analysis
    local analysis
    analysis=$(cd "$AUTOFIX_PAULY_DIR" && claude --print "$prompt" 2>/dev/null)

    if [ -z "$analysis" ]; then
        autofix_log "Claude analysis returned empty response"
        return 1
    fi

    # Save analysis for debugging
    echo "$analysis" > "$analysis_file"
    autofix_log "Analysis saved to $analysis_file"

    # Parse the response
    local fixable=$(echo "$analysis" | grep -E "^FIXABLE:" | head -1 | cut -d: -f2 | tr -d ' ')
    local reason=$(echo "$analysis" | grep -E "^REASON:" | head -1 | cut -d: -f2-)
    local file=$(echo "$analysis" | grep -E "^FILE:" | head -1 | cut -d: -f2 | tr -d ' ')
    local description=$(echo "$analysis" | grep -E "^DESCRIPTION:" | head -1 | cut -d: -f2-)

    # Export for use by caller
    export AUTOFIX_FIXABLE="$fixable"
    export AUTOFIX_REASON="$reason"
    export AUTOFIX_FILE="$file"
    export AUTOFIX_DESCRIPTION="$description"

    autofix_log "Analysis result: FIXABLE=$fixable, FILE=$file"

    if [ "$fixable" = "yes" ]; then
        return 0
    else
        return 1
    fi
}

# ==========================================
# Fix Implementation
# ==========================================

attempt_autofix() {
    local script_name="$1"
    local error_message="$2"
    local log_tail="$3"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local branch_name="${AUTOFIX_BRANCH_PREFIX:-autofix}/${script_name}-${timestamp}"
    local attempt_log="$AUTOFIX_LOG_DIR/attempt-${timestamp}.log"

    autofix_log "Attempting auto-fix for $script_name"

    # Save original branch
    local original_branch
    original_branch=$(git -C "$AUTOFIX_PAULY_DIR" rev-parse --abbrev-ref HEAD)

    # Create new branch
    autofix_log "Creating branch: $branch_name"
    if ! git -C "$AUTOFIX_PAULY_DIR" checkout -b "$branch_name" >> "$attempt_log" 2>&1; then
        autofix_log_error "Failed to create branch"
        git -C "$AUTOFIX_PAULY_DIR" checkout "$original_branch" 2>/dev/null
        return 1
    fi

    # Build the fix prompt
    local fix_prompt="You are fixing a bug in the Pauly CLI tool (a bash-based automation tool).

SCRIPT THAT FAILED: $script_name
ERROR: $error_message
FILE TO FIX: $AUTOFIX_FILE
ISSUE: $AUTOFIX_DESCRIPTION

RECENT LOG OUTPUT:
$log_tail

TASK: Fix the bug in the identified file.

Rules:
1. Make the MINIMAL change needed to fix the bug
2. Do not add new features or refactor unrelated code
3. Preserve the existing code style
4. Test your logic mentally before committing
5. If you need to read other files for context, do so first

After fixing, commit your changes with a clear message explaining the fix."

    # Run Claude to implement the fix
    autofix_log "Running Claude to implement fix..."
    if ! (cd "$AUTOFIX_PAULY_DIR" && claude --dangerously-skip-permissions "$fix_prompt") >> "$attempt_log" 2>&1; then
        autofix_log_error "Claude fix implementation failed"
        git -C "$AUTOFIX_PAULY_DIR" checkout "$original_branch" 2>/dev/null
        git -C "$AUTOFIX_PAULY_DIR" branch -D "$branch_name" 2>/dev/null
        return 1
    fi

    # Check if any changes were made
    if git -C "$AUTOFIX_PAULY_DIR" diff --quiet HEAD~1 HEAD 2>/dev/null; then
        autofix_log "No changes were committed - fix may have failed"
        git -C "$AUTOFIX_PAULY_DIR" checkout "$original_branch" 2>/dev/null
        git -C "$AUTOFIX_PAULY_DIR" branch -D "$branch_name" 2>/dev/null
        return 1
    fi

    # Push the branch
    autofix_log "Pushing branch to remote..."
    if ! git -C "$AUTOFIX_PAULY_DIR" push -u origin "$branch_name" >> "$attempt_log" 2>&1; then
        autofix_log_error "Failed to push branch"
        git -C "$AUTOFIX_PAULY_DIR" checkout "$original_branch" 2>/dev/null
        git -C "$AUTOFIX_PAULY_DIR" branch -D "$branch_name" 2>/dev/null
        return 1
    fi

    # Create PR
    autofix_log "Creating pull request..."
    local pr_title="Auto-fix: $script_name - $AUTOFIX_DESCRIPTION"
    local pr_body="## Auto-Fix PR

**Script:** \`$script_name\`
**Error:** $error_message

### Analysis
$AUTOFIX_REASON

### Description
$AUTOFIX_DESCRIPTION

---
*This PR was automatically generated by Pauly's auto-fix feature.*
*Please review carefully before merging.*"

    local pr_url
    pr_url=$(cd "$AUTOFIX_PAULY_DIR" && gh pr create \
        --title "$pr_title" \
        --body "$pr_body" \
        --head "$branch_name" \
        2>> "$attempt_log")

    if [ -z "$pr_url" ]; then
        autofix_log_error "Failed to create PR"
        git -C "$AUTOFIX_PAULY_DIR" checkout "$original_branch" 2>/dev/null
        return 1
    fi

    autofix_log "PR created: $pr_url"

    # Return to original branch
    git -C "$AUTOFIX_PAULY_DIR" checkout "$original_branch" >> "$attempt_log" 2>&1

    # Export PR URL for notification
    export AUTOFIX_PR_URL="$pr_url"

    return 0
}

# ==========================================
# Notification
# ==========================================

send_autofix_notification() {
    local script_name="$1"
    local pr_url="$2"
    local success="$3"

    if [ -z "${EMAIL:-}" ]; then
        autofix_log "No email configured - skipping notification"
        return
    fi

    local subject
    local body

    if [ "$success" = "true" ]; then
        subject="Pauly Auto-Fix: PR Created for $script_name"
        body="Pauly detected an error in $script_name and created a fix.

Pull Request: $pr_url

Issue: $AUTOFIX_DESCRIPTION

Please review and merge if the fix looks correct.

---
This is an automated message from Pauly Auto-Fix."
    else
        subject="Pauly Auto-Fix: Could not fix $script_name"
        body="Pauly attempted to auto-fix an error in $script_name but was unable to create a fix.

Reason: $AUTOFIX_REASON

Please investigate manually.

---
This is an automated message from Pauly Auto-Fix."
    fi

    if command -v mail &> /dev/null; then
        echo "$body" | mail -s "$subject" "$EMAIL"
        autofix_log "Notification sent to $EMAIL"
    fi
}

# ==========================================
# Main Entry Point
# ==========================================

run_autofix() {
    local script_name="$1"
    local error_message="$2"
    local log_tail="$3"

    autofix_log "=== Auto-fix triggered for $script_name ==="

    # Check eligibility
    if ! autofix_is_eligible "$script_name"; then
        return 1
    fi

    # Try to acquire lock
    if ! autofix_acquire_lock; then
        autofix_log "Could not acquire lock - another auto-fix may be running"
        return 1
    fi

    # Ensure we release lock on exit
    trap 'autofix_release_lock' EXIT

    # Analyze the error
    if ! analyze_error "$script_name" "$error_message" "$log_tail"; then
        autofix_log "Error not fixable: $AUTOFIX_REASON"
        send_autofix_notification "$script_name" "" "false"
        autofix_release_lock
        trap - EXIT
        return 1
    fi

    # Attempt the fix
    if attempt_autofix "$script_name" "$error_message" "$log_tail"; then
        autofix_log "Auto-fix successful: $AUTOFIX_PR_URL"
        send_autofix_notification "$script_name" "$AUTOFIX_PR_URL" "true"
        autofix_release_lock
        trap - EXIT
        return 0
    else
        autofix_log "Auto-fix failed"
        send_autofix_notification "$script_name" "" "false"
        autofix_release_lock
        trap - EXIT
        return 1
    fi
}

# ==========================================
# CLI Commands
# ==========================================

autofix_status() {
    echo ""
    echo "Auto-Fix Status"
    echo "==============="
    echo ""

    # Check if enabled
    if [ "${AUTOFIX_ENABLED:-false}" = "true" ]; then
        echo -e "  Status:     \033[0;32m●\033[0m Enabled"
    else
        echo -e "  Status:     \033[0;31m○\033[0m Disabled"
    fi

    # Show configuration
    echo "  Scripts:    ${AUTOFIX_SCRIPTS:-all}"
    echo "  Max tries:  ${AUTOFIX_MAX_ATTEMPTS:-1}"
    echo "  Branch:     ${AUTOFIX_BRANCH_PREFIX:-autofix}/<script>-<timestamp>"
    echo ""

    # Check lock status
    if [ -f "$AUTOFIX_LOCK_FILE" ]; then
        local lock_time=$(cat "$AUTOFIX_LOCK_FILE" 2>/dev/null || echo "0")
        local now=$(date +%s)
        local age=$((now - lock_time))
        echo -e "  Lock:       \033[0;33m!\033[0m Active (age: ${age}s)"
    else
        echo "  Lock:       None"
    fi
    echo ""

    # Show recent attempts
    echo "Recent Attempts:"
    if [ -d "$AUTOFIX_LOG_DIR" ]; then
        local attempts=$(ls -1t "$AUTOFIX_LOG_DIR"/attempt-*.log 2>/dev/null | head -5)
        if [ -n "$attempts" ]; then
            for attempt in $attempts; do
                local name=$(basename "$attempt" .log)
                local timestamp=$(echo "$name" | sed 's/attempt-//')
                echo "  - $timestamp"
            done
        else
            echo "  (none)"
        fi
    else
        echo "  (none)"
    fi
    echo ""
}

autofix_test() {
    echo ""
    echo "Auto-Fix Test"
    echo "============="
    echo ""

    # Check prerequisites
    echo "Checking prerequisites..."

    local prereqs_ok=true

    if command -v claude &> /dev/null; then
        echo -e "  \033[0;32m✓\033[0m Claude CLI found"
    else
        echo -e "  \033[0;31m✗\033[0m Claude CLI not found"
        prereqs_ok=false
    fi

    if command -v gh &> /dev/null; then
        echo -e "  \033[0;32m✓\033[0m GitHub CLI found"
    else
        echo -e "  \033[0;31m✗\033[0m GitHub CLI not found"
        prereqs_ok=false
    fi

    if git -C "$AUTOFIX_PAULY_DIR" rev-parse --git-dir &> /dev/null; then
        echo -e "  \033[0;32m✓\033[0m Git repository found"
    else
        echo -e "  \033[0;31m✗\033[0m Not a git repository"
        prereqs_ok=false
    fi

    if [ "${AUTOFIX_ENABLED:-false}" = "true" ]; then
        echo -e "  \033[0;32m✓\033[0m Auto-fix enabled"
    else
        echo -e "  \033[0;31m✗\033[0m Auto-fix disabled (enable with 'pauly config')"
        prereqs_ok=false
    fi

    echo ""

    if [ "$prereqs_ok" = false ]; then
        echo "Prerequisites not met. Fix the above issues first."
        return 1
    fi

    # Run a simulated failure analysis
    echo "Running simulated failure analysis..."
    echo ""

    local test_error="test: line 42: syntax error near unexpected token"
    local test_log="Running test script...
[2024-01-01 12:00:00] Starting process
[2024-01-01 12:00:01] Processing data
test: line 42: syntax error near unexpected token
[2024-01-01 12:00:01] Script failed"

    if analyze_error "test-script.sh" "$test_error" "$test_log"; then
        echo "Analysis result: FIXABLE"
        echo "  Reason: $AUTOFIX_REASON"
        echo "  File: $AUTOFIX_FILE"
        echo "  Description: $AUTOFIX_DESCRIPTION"
    else
        echo "Analysis result: NOT FIXABLE"
        echo "  Reason: $AUTOFIX_REASON"
    fi

    echo ""
    echo "Test complete. No actual changes were made."
    echo ""
}

autofix_logs() {
    local log_file="$AUTOFIX_LOG_DIR/autofix.log"

    if [ -f "$log_file" ]; then
        echo "Auto-Fix Log: $log_file"
        echo ""
        tail -100 "$log_file"
    else
        echo "No auto-fix logs found."
    fi
}
