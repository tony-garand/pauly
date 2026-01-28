#!/bin/bash

# GitHub Issues Task Runner
# Watches a GitHub repo for issues with the 'pauly' label and executes them

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# GitHub settings from config
GITHUB_TASKS_REPO="${GITHUB_TASKS_REPO:-}"
GITHUB_TASKS_LABEL="${GITHUB_TASKS_LABEL:-pauly}"

# Check if GitHub tasks are configured
github_tasks_configured() {
    [ -n "$GITHUB_TASKS_REPO" ] && command -v gh &>/dev/null
}

# Extract project from labels (looks for project:name pattern)
get_project_from_labels() {
    local labels="$1"
    echo "$labels" | tr ',' '\n' | grep "^project:" | sed 's/^project://' | head -1
}

# Get the working directory for a task
get_task_directory() {
    local project="$1"

    if [ -n "$project" ]; then
        local project_path="${PROJECTS_DIR:-$HOME/Projects}/$project"
        if [ -d "$project_path" ]; then
            echo "$project_path"
            return 0
        else
            log_error "Project directory not found: $project_path"
            return 1
        fi
    elif [ -n "$DEV_PROJECT_DIR" ] && [ -d "$DEV_PROJECT_DIR" ]; then
        echo "$DEV_PROJECT_DIR"
        return 0
    else
        echo "${PROJECTS_DIR:-$HOME/Projects}"
        return 0
    fi
}

# Process a dev command from issue
process_github_dev_command() {
    local cmd="$1"
    local body="$2"
    local work_dir="$3"

    # Parse the dev subcommand
    local subcmd=$(echo "$cmd" | awk '{print $2}')
    local args=$(echo "$cmd" | cut -d' ' -f3-)

    cd "$work_dir" || return 1

    case "$subcmd" in
        init)
            # Create idea file from issue body
            local idea_file=$(mktemp)
            echo "$body" > "$idea_file"
            "$SCRIPT_DIR/pauly" dev init "$idea_file" 2>&1
            rm -f "$idea_file"
            ;;

        task)
            local task_desc="${body:-$args}"
            "$SCRIPT_DIR/pauly" dev task "$task_desc" 2>&1
            ;;

        status|st)
            "$SCRIPT_DIR/pauly" dev status 2>&1
            ;;

        [0-9]*)
            "$SCRIPT_DIR/pauly" dev "$subcmd" 2>&1
            ;;

        ""|run)
            local iterations="${args:-25}"
            "$SCRIPT_DIR/pauly" dev "$iterations" 2>&1
            ;;

        *)
            echo "Unknown dev command: $subcmd"
            echo ""
            echo "Available dev commands:"
            echo "  dev init     - Issue body contains the project idea"
            echo "  dev task     - Issue body contains the task description"
            echo "  dev 10       - Run 10 iterations"
            echo "  dev          - Run default iterations"
            echo "  dev status   - Show development progress"
            return 1
            ;;
    esac
}

# Process a single issue
process_issue() {
    local issue_number="$1"
    local title="$2"
    local body="$3"
    local labels="$4"

    log "Processing issue #$issue_number: $title"

    # Comment that we're working on it
    gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
        --body "🤖 **Pauly is working on this...**" 2>/dev/null

    # Get project from labels
    local project=$(get_project_from_labels "$labels")
    local work_dir=$(get_task_directory "$project")

    if [ $? -ne 0 ]; then
        gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
            --body "❌ **Error:** Could not find project directory for: $project" 2>/dev/null
        return 1
    fi

    log "Working directory: $work_dir"

    # Determine task type from title
    local title_lower=$(echo "$title" | tr '[:upper:]' '[:lower:]')
    local result=""

    if [[ "$title_lower" =~ ^dev ]]; then
        # Dev command
        log "Running dev command: $title_lower"
        echo "------- Dev Command Output -------"

        local temp_output=$(mktemp)
        process_github_dev_command "$title_lower" "$body" "$work_dir" 2>&1 | tee "$temp_output"
        result=$(cat "$temp_output")
        rm -f "$temp_output"

        echo "------- End Dev Command Output -------"
    else
        # Regular task - execute via Claude
        cd "$work_dir" || return 1
        log "Starting Claude for task: $title"
        echo "------- Claude Output -------"

        # Run Claude and capture output while streaming to console
        local temp_output=$(mktemp)
        claude --dangerously-skip-permissions -p "You received a task via GitHub issue. Execute it and provide a summary of what you did.

Title: $title

Task:
$body

Working directory: $work_dir

Execute this task and provide a clear summary of the results." 2>&1 | tee "$temp_output"

        result=$(cat "$temp_output")
        rm -f "$temp_output"

        echo "------- End Claude Output -------"
    fi

    log "Task completed (${#result} chars of output)"

    # Post results as comment
    local result_comment="## Results

\`\`\`
$result
\`\`\`

---
🤖 *Completed by Pauly*"

    gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
        --body "$result_comment" 2>/dev/null

    # Close the issue
    gh issue close "$issue_number" -R "$GITHUB_TASKS_REPO" 2>/dev/null

    log "Issue #$issue_number completed and closed"
}

main() {
    log "Checking for GitHub tasks..."

    # Check if configured
    if ! github_tasks_configured; then
        log "GitHub tasks not configured. Skipping."
        return 0
    fi

    # Check gh auth
    if ! gh auth status &>/dev/null; then
        log_error "GitHub CLI not authenticated. Run 'gh auth login' first."
        return 1
    fi

    ensure_claude || return 1

    # Fetch open issues with the pauly label
    local issues=$(gh issue list -R "$GITHUB_TASKS_REPO" \
        --label "$GITHUB_TASKS_LABEL" \
        --state open \
        --json number,title,body,labels \
        --limit 10 2>/dev/null)

    if [ -z "$issues" ] || [ "$issues" = "[]" ]; then
        log "No pending tasks found."
        return 0
    fi

    # Process each issue
    echo "$issues" | jq -c '.[]' | while read -r issue; do
        local number=$(echo "$issue" | jq -r '.number')
        local title=$(echo "$issue" | jq -r '.title')
        local body=$(echo "$issue" | jq -r '.body')
        local labels=$(echo "$issue" | jq -r '[.labels[].name] | join(",")')

        process_issue "$number" "$title" "$body" "$labels"
    done

    log "GitHub task check complete."
}

run_with_alerts "github-tasks" main
