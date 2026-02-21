#!/bin/bash

# GitHub Issues Task Runner
# Watches a GitHub repo for issues with the 'pauly' label and executes them

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/queue.sh" 2>/dev/null || true

# GitHub settings from config
GITHUB_TASKS_REPO="${GITHUB_TASKS_REPO:-}"
GITHUB_TASKS_LABEL="${GITHUB_TASKS_LABEL:-pauly}"
GITHUB_IN_PROGRESS_LABEL="in-progress"

# Check if GitHub tasks are configured
github_tasks_configured() {
    [ -n "$GITHUB_TASKS_REPO" ] && ensure_gh
}

# Extract project from labels (looks for project:name or product:name pattern)
get_project_from_labels() {
    local labels="$1"
    # Check for project: first, then product: (both are valid)
    local project=$(echo "$labels" | tr ',' '\n' | grep "^project:" | sed 's/^project://' | head -1)
    if [ -z "$project" ]; then
        project=$(echo "$labels" | tr ',' '\n' | grep "^product:" | sed 's/^product://' | head -1)
    fi
    echo "$project"
}

# Check if this is a Pauly self-referential task (about Pauly itself, not a project)
is_pauly_task() {
    local title="$1"
    local body="$2"
    local labels="$3"

    # If it has a project/product label, it's NOT a Pauly task
    local has_project=$(echo "$labels" | tr ',' '\n' | grep -E "^(project|product):" | head -1)
    if [ -n "$has_project" ]; then
        return 1
    fi

    # Check if title or body mentions ~/.pauly or pauly-related work
    local title_lower=$(echo "$title" | tr '[:upper:]' '[:lower:]')
    if [[ "$title_lower" == "pauly" ]] || [[ "$title_lower" =~ ^pauly[[:space:]] ]] || [[ "$title_lower" =~ pauly$ ]]; then
        return 0
    fi

    # Check body for ~/.pauly references
    if echo "$body" | grep -qE '~/.pauly|\.pauly/|pauly (cli|script|config|admin|dev|task)'; then
        return 0
    fi

    return 1
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
# IMPORTANT: Only creates directories in ~/Projects if there's an explicit project/product label
get_task_directory() {
    local project="$1"
    local title="$2"
    local create_if_missing="${3:-false}"
    local has_explicit_label="${4:-false}"  # Whether project came from explicit label
    local projects_base="${PROJECTS_DIR:-$HOME/Projects}"

    if [ -n "$project" ]; then
        # Try case-insensitive match first
        local found_path=$(find_project_dir_case_insensitive "$projects_base" "$project")
        if [ -n "$found_path" ]; then
            echo "$found_path"
            return 0
        elif [ "$create_if_missing" = "true" ] && [ "$has_explicit_label" = "true" ]; then
            # Only create new project directory if there was an EXPLICIT project/product label
            local project_path="$projects_base/$project"
            echo "Creating new project directory: $project_path" >&2
            mkdir -p "$project_path"
            echo "$project_path"
            return 0
        elif [ "$create_if_missing" = "true" ]; then
            # No explicit label - refuse to create in ~/Projects
            echo "ERROR: No project/product label and project '$project' doesn't exist. Not creating in ~/Projects." >&2
            return 1
        else
            echo "Project directory not found: $projects_base/$project" >&2
            return 1
        fi
    elif [ -n "$DEV_PROJECT_DIR" ] && [ -d "$DEV_PROJECT_DIR" ]; then
        echo "$DEV_PROJECT_DIR"
        return 0
    else
        # No explicit project - try to find an EXISTING project only (never create)
        # Look for patterns like "word.word" or "word-word" that look like project names
        local inferred_project=$(echo "$title" | grep -oE '[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]+' | head -1)
        if [ -z "$inferred_project" ]; then
            inferred_project=$(echo "$title" | grep -oE '[a-zA-Z0-9][-a-zA-Z0-9]{2,}' | head -1)
        fi

        if [ -n "$inferred_project" ]; then
            # Try case-insensitive match for inferred project (EXISTING ONLY)
            local found_path=$(find_project_dir_case_insensitive "$projects_base" "$inferred_project")
            if [ -n "$found_path" ]; then
                echo "Found existing project directory: $found_path" >&2
                echo "$found_path"
                return 0
            fi
            # NOTE: Never create directory for inferred projects - require explicit label
        fi

        # No project found and no explicit label - return empty (caller should handle)
        return 1
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
            local iterations="${args:-0}"
            "$SCRIPT_DIR/pauly" dev "$iterations" 2>&1
            ;;

        *)
            echo "Unknown dev command: $subcmd"
            echo ""
            echo "Available dev commands:"
            echo "  dev init     - Issue body contains the project idea"
            echo "  dev task     - Issue body contains the task description"
            echo "  dev 10       - Run 10 iterations"
            echo "  dev          - Run until complete (unlimited)"
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

# ============================================================================
# PROJECT LOCKING - Only 1 task per project at a time
# ============================================================================

# Get lock path for a project (uses sanitized path as identifier)
get_project_lock_path() {
    local work_dir="$1"
    # Sanitize path: replace / with _ to create a flat lock file name
    local sanitized=$(echo "$work_dir" | sed 's|/|_|g' | sed 's|^_||')
    echo "$SCRIPT_DIR/logs/project-locks/$sanitized"
}

# Try to acquire lock for a project (atomic - mkdir fails if exists)
acquire_project_lock() {
    local work_dir="$1"
    local issue_number="$2"
    local lock_path=$(get_project_lock_path "$work_dir")

    # Ensure parent directory exists
    mkdir -p "$(dirname "$lock_path")"

    # Try to create lock directory (atomic operation)
    if mkdir "$lock_path" 2>/dev/null; then
        # Write start time and issue number for tracking
        date +%s > "$lock_path/started"
        echo "$issue_number" > "$lock_path/issue"
        log "Acquired project lock for $work_dir (issue #$issue_number)"
        return 0
    fi
    return 1
}

# Release lock for a project
release_project_lock() {
    local work_dir="$1"
    local lock_path=$(get_project_lock_path "$work_dir")

    if [ -d "$lock_path" ]; then
        rm -rf "$lock_path"
        log "Released project lock for $work_dir"
    fi
}

# Get info about who holds the project lock
get_project_lock_info() {
    local work_dir="$1"
    local lock_path=$(get_project_lock_path "$work_dir")

    if [ -d "$lock_path" ]; then
        local issue=$(cat "$lock_path/issue" 2>/dev/null || echo "unknown")
        local start_time=$(cat "$lock_path/started" 2>/dev/null || echo "0")
        local now=$(date +%s)
        local age=$((now - start_time))
        local age_mins=$((age / 60))
        echo "issue=#$issue, running for ${age_mins}m"
    else
        echo ""
    fi
}

# Check if project is locked
is_project_locked() {
    local work_dir="$1"
    local lock_path=$(get_project_lock_path "$work_dir")
    [ -d "$lock_path" ]
}

# Get lock age for stale lock cleanup
get_project_lock_age() {
    local work_dir="$1"
    local lock_path=$(get_project_lock_path "$work_dir")
    local started_file="$lock_path/started"

    if [ -f "$started_file" ]; then
        local start_time=$(cat "$started_file")
        local now=$(date +%s)
        echo $((now - start_time))
    else
        echo "0"
    fi
}

# ============================================================================
# QUEUE-BASED TASK PROCESSING (optional - when QUEUE_ENABLED=true)
# ============================================================================

# Enqueue a GitHub issue as a job in the SQLite queue
enqueue_github_issue() {
    local issue_number="$1"
    local title="$2"
    local body="$3"
    local labels="$4"
    local project="$5"
    local work_dir="$6"

    if ! queue_enabled; then
        return 1
    fi

    local task_data=$(jq -n \
        --arg number "$issue_number" \
        --arg title "$title" \
        --arg body "$body" \
        --arg labels "$labels" \
        --arg project "$project" \
        --arg workDir "$work_dir" \
        '{
            issueNumber: $number,
            title: $title,
            body: $body,
            labels: $labels,
            projectName: $project,
            workDir: $workDir
        }')

    local result=$(queue_enqueue "github-issue" 0 "" "$task_data")
    local job_id=$(echo "$result" | jq -r '.id // empty')

    if [[ -n "$job_id" ]]; then
        log "Enqueued issue #$issue_number as job #$job_id"
        echo "$job_id"
        return 0
    fi

    return 1
}

# Process jobs from the queue (worker loop)
process_queue_jobs() {
    if ! queue_enabled; then
        return 1
    fi

    local worker_id=$(generate_worker_id)
    log "Starting queue worker: $worker_id"

    # Cleanup stale jobs first
    queue_cleanup 60 30 >/dev/null 2>&1

    # Process up to 10 jobs in one run
    local jobs_processed=0
    local max_jobs=10

    while [[ $jobs_processed -lt $max_jobs ]]; do
        local result=$(queue_dequeue "$worker_id")

        if ! queue_acquired "$result"; then
            log "No more jobs available"
            break
        fi

        local job_id=$(queue_job_id "$result")
        local task_type=$(queue_job_type "$result")
        local task_data=$(queue_job_data "$result")

        log "Processing job #$job_id ($task_type)"

        local start_time=$(date +%s%3N)

        case "$task_type" in
            github-issue)
                local issue_number=$(echo "$task_data" | jq -r '.issueNumber')
                local title=$(echo "$task_data" | jq -r '.title')
                local body=$(echo "$task_data" | jq -r '.body')
                local labels=$(echo "$task_data" | jq -r '.labels')

                if process_issue "$issue_number" "$title" "$body" "$labels"; then
                    local end_time=$(date +%s%3N)
                    local duration=$((end_time - start_time))
                    queue_ack "$job_id" "$duration"
                    log "Job #$job_id completed in ${duration}ms"
                else
                    local end_time=$(date +%s%3N)
                    local duration=$((end_time - start_time))
                    queue_nack "$job_id" "Issue processing failed" "false" "$duration"
                    log "Job #$job_id failed"
                fi
                ;;
            *)
                queue_nack "$job_id" "Unknown task type: $task_type" "false"
                log "Job #$job_id: unknown task type"
                ;;
        esac

        ((jobs_processed++))
    done

    log "Queue worker finished: $jobs_processed jobs processed"
}

# Session tracking for project-scoped --continue
# Only use --continue within the same project to avoid cross-project contamination
SESSION_PROJECT_FILE="$SCRIPT_DIR/logs/.current-project-session"

# Check if we can use --continue (same project as last session)
can_continue_session() {
    local current_project="$1"
    if [[ -f "$SESSION_PROJECT_FILE" ]]; then
        local last_project=$(cat "$SESSION_PROJECT_FILE" 2>/dev/null)
        [[ "$last_project" == "$current_project" ]]
    else
        return 1
    fi
}

# Mark current project as active session
set_session_project() {
    local project="$1"
    echo "$project" > "$SESSION_PROJECT_FILE"
}

# Clear session when done with project
clear_session_project() {
    rm -f "$SESSION_PROJECT_FILE"
}

# Run tasks one by one from TASKS.md
# Uses --continue within the same project for efficiency, fresh sessions across projects
# Posts a progress comment every 25 tasks completed
run_tasks_from_file() {
    local work_dir="$1"
    local issue_number="$2"
    local tasks_done=0
    local first_task=true
    local checkpoint_interval=25

    cd "$work_dir" || return 1

    # Check if we're continuing in the same project or starting fresh
    local use_continue=false
    if can_continue_session "$work_dir"; then
        use_continue=true
        echo "Continuing session in same project..."
    else
        echo "Starting fresh session for project: $(basename "$work_dir")"
        set_session_project "$work_dir"
    fi

    while true; do
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

        local task_output=$(mktemp)

        if [[ "$first_task" == "true" && "$use_continue" == "false" ]]; then
            # First task in new project: fresh session with full context
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
            first_task=false
        else
            # Subsequent tasks in same project: use --continue for efficiency
            if ! claude --dangerously-skip-permissions --continue -p "Next task: $task

Current progress: $progress

Implement this task, test it works, mark it done in TASKS.md, and commit.
Remember: only work on THIS task." 2>&1 | tee "$task_output"; then
                # Fallback to fresh session if --continue fails
                echo "Session continue failed, starting fresh..."
                claude --dangerously-skip-permissions -p "You are resuming work on a project.

Read CONTEXT.md and TASKS.md to understand this project.

Current progress: $progress

Implement this task:
TASK: $task

Instructions:
1. Implement this specific task
2. Test that it works
3. Mark it done in TASKS.md: change '- [ ]' to '- [x]'
4. Commit with message: \"feat: $task\"

Only work on THIS task." 2>&1 | tee "$task_output"
            fi
        fi

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

        # Post progress comment every checkpoint_interval tasks
        if [[ -n "$issue_number" ]] && [[ $((tasks_done % checkpoint_interval)) -eq 0 ]]; then
            local checkpoint_progress=$(get_task_progress "$work_dir")
            gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
                --body "📊 **Progress checkpoint** ($checkpoint_progress)

$tasks_done tasks processed so far. Continuing..." 2>/dev/null || true
        fi
    done
}

# Issue-scoped session tracking to prevent cross-issue contamination
SESSION_ISSUE_FILE="$SCRIPT_DIR/logs/.current-issue-session"

# Check if we're continuing the same issue (not just same project)
can_continue_issue_session() {
    local current_issue="$1"
    if [[ -f "$SESSION_ISSUE_FILE" ]]; then
        local last_issue=$(cat "$SESSION_ISSUE_FILE" 2>/dev/null)
        [[ "$last_issue" == "$current_issue" ]]
    else
        return 1
    fi
}

set_session_issue() {
    local issue="$1"
    echo "$issue" > "$SESSION_ISSUE_FILE"
}

clear_session_issue() {
    rm -f "$SESSION_ISSUE_FILE"
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

    # IMPORTANT: Clear session when starting a NEW issue to prevent cross-issue contamination
    if ! can_continue_issue_session "$issue_number"; then
        log "New issue detected - clearing previous session to prevent task mixing"
        clear_session_project
        clear_session_issue
        set_session_issue "$issue_number"
    fi

    # Determine working directory based on labels
    local project=$(get_project_from_labels "$labels")
    local has_explicit_label="false"
    local work_dir=""

    if [ -n "$project" ]; then
        # Explicit project/product label - work in ~/Projects
        has_explicit_label="true"
        work_dir=$(get_task_directory "$project" "$title" "true" "true")
    elif is_pauly_task "$title" "$body" "$labels"; then
        # Task is about Pauly itself - work in ~/.pauly
        log "Detected Pauly self-referential task - working in ~/.pauly"
        work_dir="$SCRIPT_DIR"
    else
        # No explicit label and not a Pauly task - try to find existing project only
        work_dir=$(get_task_directory "" "$title" "false" "false")
    fi

    if [ $? -ne 0 ] || [ -z "$work_dir" ]; then
        local error_msg="Could not determine project directory."
        if [ -z "$project" ]; then
            error_msg="$error_msg

**Missing project/product label.** Please add a label like \`project:myproject\` or \`product:myproject\` to specify which project this task belongs to.

Without an explicit label, Pauly will NOT create new directories in ~/Projects."
        fi
        gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
            --body "❌ **Error:** $error_msg" 2>/dev/null
        gh issue edit "$issue_number" -R "$GITHUB_TASKS_REPO" \
            --remove-label "$GITHUB_IN_PROGRESS_LABEL" 2>/dev/null
        release_issue_lock "$issue_number"
        return 1
    fi

    log "Working directory: $work_dir (explicit_label=$has_explicit_label)"

    # PROJECT LOCK: Only 1 task per project at a time
    if ! acquire_project_lock "$work_dir" "$issue_number"; then
        local lock_info=$(get_project_lock_info "$work_dir")
        log "Project $work_dir is locked ($lock_info) - skipping issue #$issue_number"

        gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
            --body "⏳ **Waiting for project lock**

Another task is currently running on this project ($lock_info).

This issue will be processed once the other task completes.

_Checked at $(date '+%Y-%m-%d %H:%M:%S')_" 2>/dev/null

        # Remove in-progress label since we're not actually processing
        gh issue edit "$issue_number" -R "$GITHUB_TASKS_REPO" \
            --remove-label "$GITHUB_IN_PROGRESS_LABEL" 2>/dev/null
        release_issue_lock "$issue_number"
        return 0
    fi

    # Clear session if switching to a different project (ensures isolation)
    if ! can_continue_session "$work_dir"; then
        clear_session_project
    fi

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

=== ISSUE CONTEXT ===
Issue Number: #$issue_number
Title: $title
Labels: $labels
Working directory: $work_dir

=== TASK DESCRIPTION ===
$body

=== INSTRUCTIONS ===
CRITICAL: You are working on issue #$issue_number ONLY. Do not mix tasks from other issues.
This task is ISOLATED to: $work_dir

If this is a substantial project or feature:
1. Create a TASKS.md file in the ROOT of the working directory ($work_dir/TASKS.md) with a checklist of tasks to complete
2. Create a CONTEXT.md file in the ROOT of the working directory ($work_dir/CONTEXT.md) with project overview and commands
3. Do NOT put these files in a subdirectory like tasks/ - they MUST be at the project root
4. Do NOT mark the task as done - just set up the plan

If this is a simple task you can complete immediately:
1. Execute it fully
2. Verify it works
3. Provide a summary

Respond with what you did." 2>&1 | tee "$temp_output"

        result=$(cat "$temp_output")
        rm -f "$temp_output"

        echo "------- End Claude Output -------"

        # Commit any changes from this step
        if [[ -d .git ]] && [[ -n $(git status --porcelain 2>/dev/null) ]]; then
            echo "Committing changes..."
            git add -A
            git commit -m "feat: $title" 2>/dev/null || true
            git push 2>/dev/null || git push -u origin "$(git branch --show-current)" 2>/dev/null || true
        fi

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

            run_tasks_from_file "$work_dir" "$issue_number" 2>&1 | tee "$loop_output_file"

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
                # Release locks so next run can continue
                release_project_lock "$work_dir"
                release_issue_lock "$issue_number"
                log "Issue #$issue_number still in progress"
                return 0
            fi
        fi
    fi

    log "Task completed (${#result} chars of output)"

    # Check if TODO.md was created/modified and notify
    local todo_file="$work_dir/TODO.md"
    local todo_notification=""
    if [[ -f "$todo_file" ]]; then
        local todo_preview=$(head -20 "$todo_file" | sed 's/```/\`\`\`/g')
        todo_notification="
---

📝 **TODO.md Updated**

Non-development tasks have been added to \`TODO.md\`:

\`\`\`markdown
$todo_preview
\`\`\`

_These items require manual action and cannot be automated._"
    fi

    # Post results as comment
    local result_comment="## ✅ Completed

\`\`\`
$(tail -100 <<< "$result")
\`\`\`
$todo_notification
---
🤖 *Completed by Pauly*"

    gh issue comment "$issue_number" -R "$GITHUB_TASKS_REPO" \
        --body "$result_comment" 2>/dev/null

    # Remove in-progress label and close the issue
    gh issue edit "$issue_number" -R "$GITHUB_TASKS_REPO" \
        --remove-label "$GITHUB_IN_PROGRESS_LABEL" 2>/dev/null
    gh issue close "$issue_number" -R "$GITHUB_TASKS_REPO" 2>/dev/null

    # Release locks AFTER closing issue (at very end of function)
    release_project_lock "$work_dir"
    release_issue_lock "$issue_number"

    # Clear issue session after completion to ensure next issue starts fresh
    clear_session_issue

    log "Issue #$issue_number completed and closed"
}

main() {
    log "Checking for GitHub tasks..."

    # If queue is enabled, use queue-based processing
    if queue_enabled; then
        log "Queue mode enabled - using SQLite task queue"

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

        # First, enqueue any new issues
        local issues=$(gh issue list -R "$GITHUB_TASKS_REPO" \
            --label "$GITHUB_TASKS_LABEL" \
            --state open \
            --json number,title,body,labels \
            --limit 10 2>/dev/null | \
            jq -c "[.[] | select(.labels | map(.name) | index(\"$GITHUB_IN_PROGRESS_LABEL\") | not)]")

        if [ -n "$issues" ] && [ "$issues" != "[]" ]; then
            echo "$issues" | jq -c '.[]' | while read -r issue; do
                local number=$(echo "$issue" | jq -r '.number')
                local title=$(echo "$issue" | jq -r '.title')
                local body=$(echo "$issue" | jq -r '.body')
                local labels=$(echo "$issue" | jq -r '[.labels[].name] | join(",")')

                # Mark as in-progress to prevent re-enqueueing
                gh issue edit "$number" -R "$GITHUB_TASKS_REPO" \
                    --add-label "$GITHUB_IN_PROGRESS_LABEL" 2>/dev/null

                # Enqueue the issue
                enqueue_github_issue "$number" "$title" "$body" "$labels" "" ""
            done
        fi

        # Then process jobs from queue
        process_queue_jobs

        log "GitHub task check complete (queue mode)."
        return 0
    fi

    # ---- File-based locking mode (legacy) ----

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

    # Clean up stale project locks (older than 1 hour)
    local project_lock_dir="$SCRIPT_DIR/logs/project-locks"
    if [ -d "$project_lock_dir" ]; then
        for lock_path in "$project_lock_dir"/*; do
            [ -d "$lock_path" ] || continue

            local started_file="$lock_path/started"
            if [ -f "$started_file" ]; then
                local start_time=$(cat "$started_file")
                local age=$((now - start_time))

                if [ $age -gt $stale_threshold ]; then
                    local project_name=$(basename "$lock_path")
                    local issue_num=$(cat "$lock_path/issue" 2>/dev/null || echo "unknown")
                    log "Cleaning up stale project lock for $project_name (issue #$issue_num, ${age}s old)"
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
