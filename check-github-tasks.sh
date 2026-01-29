#!/bin/bash

# GitHub Issues Task Runner
# Watches a GitHub repo for issues with the 'pauly' label and executes them

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# GitHub settings from config
GITHUB_TASKS_REPO="${GITHUB_TASKS_REPO:-}"
GITHUB_TASKS_LABEL="${GITHUB_TASKS_LABEL:-pauly}"
GITHUB_IN_PROGRESS_LABEL="in-progress"

# Check if GitHub tasks are configured
github_tasks_configured() {
    [ -n "$GITHUB_TASKS_REPO" ] && ensure_gh
}

# Extract project from labels (looks for project:name pattern)
get_project_from_labels() {
    local labels="$1"
    echo "$labels" | tr ',' '\n' | grep "^project:" | sed 's/^project://' | head -1
}

# Find existing directory with case-insensitive matching
find_project_dir_case_insensitive() {
    local base_dir="$1"
    local name="$2"

    # First try exact match
    if [ -d "$base_dir/$name" ]; then
        echo "$base_dir/$name"
        return 0
    fi

    # Try case-insensitive match using find
    local found=$(find "$base_dir" -maxdepth 1 -type d -iname "$name" 2>/dev/null | head -1)
    if [ -n "$found" ] && [ -d "$found" ]; then
        echo "$found"
        return 0
    fi

    return 1
}

# Get the working directory for a task (creates if needed for new projects)
get_task_directory() {
    local project="$1"
    local title="$2"
    local create_if_missing="${3:-false}"
    local projects_base="${PROJECTS_DIR:-$HOME/Projects}"

    if [ -n "$project" ]; then
        # Try case-insensitive match first
        local found_path=$(find_project_dir_case_insensitive "$projects_base" "$project")
        if [ -n "$found_path" ]; then
            echo "$found_path"
            return 0
        elif [ "$create_if_missing" = "true" ]; then
            local project_path="$projects_base/$project"
            echo "Creating new project directory: $project_path" >&2
            mkdir -p "$project_path"
            echo "$project_path"
            return 0
        else
            echo "Project directory not found: $projects_base/$project" >&2
            return 1
        fi
    elif [ -n "$DEV_PROJECT_DIR" ] && [ -d "$DEV_PROJECT_DIR" ]; then
        echo "$DEV_PROJECT_DIR"
        return 0
    else
        # Try to infer project name from title (e.g., "shelfmark.app" -> shelfmark.app)
        # Look for patterns like "word.word" or "word-word" that look like project names
        local inferred_project=$(echo "$title" | grep -oE '[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]+' | head -1)
        if [ -z "$inferred_project" ]; then
            inferred_project=$(echo "$title" | grep -oE '[a-zA-Z0-9][-a-zA-Z0-9]{2,}' | head -1)
        fi

        if [ -n "$inferred_project" ]; then
            # Try case-insensitive match for inferred project
            local found_path=$(find_project_dir_case_insensitive "$projects_base" "$inferred_project")
            if [ -n "$found_path" ]; then
                echo "Found existing project directory: $found_path" >&2
                echo "$found_path"
                return 0
            elif [ "$create_if_missing" = "true" ]; then
                local project_path="$projects_base/$inferred_project"
                echo "Creating inferred project directory: $project_path" >&2
                mkdir -p "$project_path"
                echo "$project_path"
                return 0
            fi
        fi

        echo "$projects_base"
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

# Check if there are uncompleted tasks in TASKS.md
has_uncompleted_tasks() {
    local work_dir="$1"
    local tasks_file="$work_dir/TASKS.md"

    if [[ -f "$tasks_file" ]]; then
        local unchecked=$(grep -c '^\s*- \[ \]' "$tasks_file" 2>/dev/null | head -1 || echo "0")
        unchecked="${unchecked//[^0-9]/}"  # Strip non-numeric chars
        unchecked="${unchecked:-0}"
        [[ "$unchecked" -gt 0 ]]
    else
        return 1
    fi
}

# Get the first uncompleted task from TASKS.md
get_next_task() {
    local work_dir="$1"
    local tasks_file="$work_dir/TASKS.md"

    if [[ -f "$tasks_file" ]]; then
        # Get first unchecked task, strip the "- [ ] " prefix
        grep -m1 '^\s*- \[ \]' "$tasks_file" 2>/dev/null | sed 's/^\s*- \[ \] //'
    fi
}

# Get task progress summary
get_task_progress() {
    local work_dir="$1"
    local tasks_file="$work_dir/TASKS.md"

    if [[ -f "$tasks_file" ]]; then
        local total=$(grep -c '^\s*- \[' "$tasks_file" 2>/dev/null | head -1 || echo "0")
        local completed=$(grep -c '^\s*- \[x\]' "$tasks_file" 2>/dev/null | head -1 || echo "0")
        total="${total//[^0-9]/}"
        completed="${completed//[^0-9]/}"
        echo "${completed:-0}/${total:-0} tasks completed"
    else
        echo "no tasks file"
    fi
}

# Get lock directory path for an issue
get_issue_lock_path() {
    echo "$SCRIPT_DIR/logs/issue-locks/issue-$1"
}

# Try to acquire lock for an issue (atomic - mkdir fails if exists)
acquire_issue_lock() {
    local issue_number="$1"
    local lock_path=$(get_issue_lock_path "$issue_number")

    # Ensure parent directory exists
    mkdir -p "$(dirname "$lock_path")"

    # Try to create lock directory (atomic operation)
    if mkdir "$lock_path" 2>/dev/null; then
        # Write start time for tracking
        date +%s > "$lock_path/started"
        log "Acquired lock for issue #$issue_number"
        return 0
    fi
    return 1
}

# Release lock for an issue
release_issue_lock() {
    local issue_number="$1"
    local lock_path=$(get_issue_lock_path "$issue_number")

    if [ -d "$lock_path" ]; then
        rm -rf "$lock_path"
        log "Released lock for issue #$issue_number"
    fi
}

# Get how long an issue has been locked (in seconds)
get_issue_lock_age() {
    local issue_number="$1"
    local lock_path=$(get_issue_lock_path "$issue_number")
    local started_file="$lock_path/started"

    if [ -f "$started_file" ]; then
        local start_time=$(cat "$started_file")
        local now=$(date +%s)
        echo $((now - start_time))
    else
        echo "0"
    fi
}

# Run tasks one by one from TASKS.md
# Each task runs in a fresh session to avoid cross-issue context contamination
run_tasks_from_file() {
    local work_dir="$1"
    local max_tasks="${2:-50}"
    local tasks_done=0

    cd "$work_dir" || return 1

    while [[ $tasks_done -lt $max_tasks ]]; do
        # Get next uncompleted task
        local task=$(get_next_task "$work_dir")

        if [[ -z "$task" ]]; then
            echo "All tasks completed!"
            return 0
        fi

        ((tasks_done++))
        local progress=$(get_task_progress "$work_dir")
        echo ""
        echo "=== Task $tasks_done: $task ==="
        echo "Progress: $progress"

        # Run Claude with the specific task (fresh session each time)
        local task_output=$(mktemp)

        claude --dangerously-skip-permissions -p "You are working on a project with multiple tasks.

Read CONTEXT.md and TASKS.md to understand this project's:
- Purpose and architecture
- Tech stack and patterns
- Build/test commands

Current progress: $progress

Implement this task:
TASK: $task

Instructions:
1. Implement this specific task
2. Test that it works (run tests, compile, etc.)
3. When COMPLETE: Edit TASKS.md to change this task from '- [ ]' to '- [x]'
4. Commit your changes with message: \"feat: $task\"

IMPORTANT:
- Only work on THIS task, not other tasks
- Mark the task done in TASKS.md when complete
- If you can't complete it, explain why and leave it unchecked" 2>&1 | tee "$task_output"

        local output=$(cat "$task_output")
        rm -f "$task_output"

        # Commit any uncommitted changes
        if [[ -d .git ]] && [[ -n $(git status --porcelain 2>/dev/null) ]]; then
            echo "Committing changes..."
            git add -A
            git commit -m "feat: $task" 2>/dev/null || true
            git push 2>/dev/null || git push -u origin "$(git branch --show-current)" 2>/dev/null || true
        fi

        # Check if task was marked complete (escape special chars and get clean number)
        local task_pattern=$(echo "$task" | head -c 30 | sed 's/[[\.*^$()+?{|]/\\&/g')
        local still_unchecked=$(grep -c "^\s*- \[ \] $task_pattern" "$work_dir/TASKS.md" 2>/dev/null | head -1 || echo "0")
        still_unchecked="${still_unchecked//[^0-9]/}"  # Strip non-numeric chars
        still_unchecked="${still_unchecked:-0}"
        if [[ "$still_unchecked" -gt 0 ]]; then
            echo "WARNING: Task not marked complete, may be stuck"
            # Try one more time to mark it
            sleep 2
        fi
    done

    echo "Reached max tasks limit ($max_tasks)"
    return 1
}

# Process a single issue
process_issue() {
    local issue_number="$1"
    local title="$2"
    local body="$3"
    local labels="$4"

    # Try to acquire lock (atomic - prevents race conditions)
    if ! acquire_issue_lock "$issue_number"; then
        local age=$(get_issue_lock_age "$issue_number")
        local age_mins=$((age / 60))

        log "Issue #$issue_number is locked (${age_mins}m) - skipping"

        # Post status comment
        gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
            --body "🔄 **Still working...** (${age_mins} minutes elapsed)

_Checked at $(date '+%Y-%m-%d %H:%M:%S')_" 2>/dev/null || true

        return 0
    fi

    log "Processing issue #$issue_number: $title"

    # Mark as in-progress to prevent duplicate processing
    if ! gh issue edit "$issue_number" -R "$GITHUB_TASKS_REPO" \
        --add-label "$GITHUB_IN_PROGRESS_LABEL" 2>&1; then
        log "Warning: Failed to add in-progress label to issue #$issue_number"
    fi

    # Comment that we're working on it
    gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
        --body "🤖 **Pauly is working on this...**" 2>/dev/null

    # Get project from labels or infer from title
    local project=$(get_project_from_labels "$labels")
    # Allow creating directory for new projects
    local work_dir=$(get_task_directory "$project" "$title" "true")

    if [ $? -ne 0 ]; then
        gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
            --body "❌ **Error:** Could not determine project directory for: $project" 2>/dev/null
        gh issue edit "$issue_number" -R "$GITHUB_TASKS_REPO" \
            --remove-label "$GITHUB_IN_PROGRESS_LABEL" 2>/dev/null
        release_issue_lock "$issue_number"
        return 1
    fi

    log "Working directory: $work_dir"

    # Pull latest if it's a git repo
    if [ -d "$work_dir/.git" ]; then
        log "Pulling latest changes..."
        (cd "$work_dir" && git pull --ff-only 2>/dev/null) || log "Warning: git pull failed (may have local changes)"
    fi

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

        # Run Claude to plan/initialize the task
        local temp_output=$(mktemp)
        claude --dangerously-skip-permissions -p "You received a task via GitHub issue.

Title: $title

Task:
$body

Working directory: $work_dir

IMPORTANT: If this is a substantial project or feature:
1. Create a TASKS.md file with a checklist of tasks to complete
2. Create a CONTEXT.md file with project overview and commands
3. Do NOT mark the task as done - just set up the plan

If this is a simple task you can complete immediately:
1. Execute it fully
2. Verify it works
3. Provide a summary

Respond with what you did." 2>&1 | tee "$temp_output"

        result=$(cat "$temp_output")
        rm -f "$temp_output"

        echo "------- End Claude Output -------"

        # Check if Claude created a TASKS.md with uncompleted tasks
        if has_uncompleted_tasks "$work_dir"; then
            log "TASKS.md found with uncompleted tasks - running task loop"

            # Post progress update
            local progress=$(get_task_progress "$work_dir")
            gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
                --body "📋 **Plan created** ($progress)

Starting implementation..." 2>/dev/null

            # Run tasks one by one
            echo "------- Task Loop Output -------"
            local loop_output_file=$(mktemp)

            run_tasks_from_file "$work_dir" 50 2>&1 | tee "$loop_output_file"

            local loop_result=$(cat "$loop_output_file")
            rm -f "$loop_output_file"
            echo "------- End Task Loop Output -------"

            # Append loop result to overall result
            result="$result

--- Task Loop ---
$loop_result"

            # Check if all tasks are now complete
            if has_uncompleted_tasks "$work_dir"; then
                local final_progress=$(get_task_progress "$work_dir")
                log "Task loop finished but tasks remain: $final_progress"

                # Post partial progress and keep issue open
                gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
                    --body "⏸️ **Progress update** ($final_progress)

Some tasks remain. Will continue on next run.

\`\`\`
$(tail -50 <<< "$loop_result")
\`\`\`" 2>/dev/null

                # Keep in-progress label, don't close
                # Release lock so next run can continue if label is removed
                release_issue_lock "$issue_number"
                log "Issue #$issue_number still in progress"
                return 0
            fi
        fi
    fi

    log "Task completed (${#result} chars of output)"

    # Post results as comment
    local result_comment="## ✅ Completed

\`\`\`
$(tail -100 <<< "$result")
\`\`\`

---
🤖 *Completed by Pauly*"

    gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
        --body "$result_comment" 2>/dev/null

    # Remove in-progress label and close the issue
    gh issue edit "$issue_number" -R "$GITHUB_TASKS_REPO" \
        --remove-label "$GITHUB_IN_PROGRESS_LABEL" 2>/dev/null
    gh issue close "$issue_number" -R "$GITHUB_TASKS_REPO" 2>/dev/null

    # Release lock AFTER closing issue (at very end of function)
    release_issue_lock "$issue_number"

    log "Issue #$issue_number completed and closed"
}

main() {
    log "Checking for GitHub tasks..."

    # Clean up stale locks (older than 1 hour = probably crashed)
    local stale_threshold=3600
    local now=$(date +%s)
    local lock_base_dir="$SCRIPT_DIR/logs/issue-locks"

    if [ -d "$lock_base_dir" ]; then
        for lock_path in "$lock_base_dir"/issue-*; do
            [ -d "$lock_path" ] || continue

            local started_file="$lock_path/started"
            if [ -f "$started_file" ]; then
                local start_time=$(cat "$started_file")
                local age=$((now - start_time))

                if [ $age -gt $stale_threshold ]; then
                    local issue_num=$(basename "$lock_path" | sed 's/issue-//')
                    log "Cleaning up stale lock for issue #$issue_num (${age}s old)"
                    rm -rf "$lock_path"
                fi
            fi
        done
    fi

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

    # Fetch open issues with the pauly label (excluding in-progress)
    local issues=$(gh issue list -R "$GITHUB_TASKS_REPO" \
        --label "$GITHUB_TASKS_LABEL" \
        --state open \
        --json number,title,body,labels \
        --limit 10 2>/dev/null | \
        jq -c "[.[] | select(.labels | map(.name) | index(\"$GITHUB_IN_PROGRESS_LABEL\") | not)]")

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
