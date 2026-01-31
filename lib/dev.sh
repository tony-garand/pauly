#!/bin/bash

# Autonomous Development System for Pauly
# Based on the PLAN → EXECUTE → REVIEW → FIX loop

DEV_DIR=".pauly"
DEV_LOG_DIR="$DEV_DIR/logs"
DEV_TASK_DIR="$DEV_DIR/tasks"
TASK_FILE="TASKS.md"
CONTEXT_FILE="CONTEXT.md"
TASK_STATE=".task"

# Retry settings
MAX_RETRIES=5
RETRY_DELAY=10
SESSION_WAIT=300  # 5 minutes wait on session limits

# Ensure directories exist
ensure_dev_dirs() {
    mkdir -p "$DEV_DIR" "$DEV_LOG_DIR" "$DEV_TASK_DIR"
}

# Timestamped echo for console output
ts_echo() {
    local timestamp=$(date '+%H:%M:%S')
    echo -e "[$timestamp] $1"
}

# Development logging
dev_log() {
    local level="$1"
    local msg="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="$DEV_LOG_DIR/dev.log"
    ensure_dev_dirs
    echo "[$timestamp] [$level] $msg" >> "$log_file"
}

# Log failure with context
log_dev_failure() {
    local phase="$1"
    local attempt="$2"
    local exit_code="$3"
    local output="$4"

    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local fail_file="$DEV_LOG_DIR/failure_${timestamp//[: -]/_}.log"

    ensure_dev_dirs

    {
        echo "=== PAULY DEV FAILURE LOG ==="
        echo "Timestamp: $timestamp"
        echo "Phase: $phase"
        echo "Attempt: $attempt/$MAX_RETRIES"
        echo "Exit code: $exit_code"
        echo "Working directory: $(pwd)"
        echo ""
        echo "=== CLAUDE OUTPUT ==="
        echo "$output"
        echo ""
        echo "=== CURRENT .task FILE ==="
        if [[ -f "$TASK_STATE" ]]; then
            cat "$TASK_STATE"
        else
            echo "(no .task file)"
        fi
    } > "$fail_file"

    dev_log "ERROR" "Failure logged to $fail_file"
    ts_echo "${YELLOW}Failure details saved to: $fail_file${NC}"
}

# Check for Claude CLI
ensure_claude_dev() {
    if command -v claude &> /dev/null; then
        return 0
    fi

    # Check common locations (cron/subprocess doesn't have full PATH)
    local claude_paths=(
        "$HOME/.local/bin/claude"
        "/usr/local/bin/claude"
        "$HOME/.claude/local/claude"
        "$HOME/.npm-global/bin/claude"
    )

    for path in "${claude_paths[@]}"; do
        if [ -x "$path" ]; then
            export PATH="$(dirname "$path"):$PATH"
            return 0
        fi
    done

    ts_echo "${RED}Error: Claude CLI not found${NC}"
    echo "Install with: npm install -g @anthropic-ai/claude-code"
    return 1
}

# Run Claude with retry logic and session limit handling
# Usage: run_claude_dev "prompt" "PHASE" ["true"|"false"]
# Third arg: use_continue - if "true", uses --continue flag to maintain session context
run_claude_dev() {
    local prompt="$1"
    local phase="$2"
    local use_continue="${3:-false}"
    local attempt=1
    local output=""
    local exit_code=0

    # Build continue flag
    local continue_flag=""
    if [[ "$use_continue" == "true" ]]; then
        continue_flag="--continue"
    fi

    dev_log "INFO" "Starting $phase (continue=$use_continue)"

    while [[ $attempt -le $MAX_RETRIES ]]; do
        ts_echo "${BLUE}Running $phase (attempt $attempt/$MAX_RETRIES)...${NC}"

        set +e
        output=$(claude --dangerously-skip-permissions $continue_flag -p "$prompt" 2>&1)
        exit_code=$?
        set -e

        # Success
        if [[ $exit_code -eq 0 ]]; then
            dev_log "INFO" "$phase completed successfully"
            echo "$output"
            return 0
        fi

        # Check for rate limit / overloaded
        if echo "$output" | grep -qiE "overloaded|rate.limit|too.many.requests|529|503"; then
            dev_log "WARN" "$phase failed (overloaded), attempt $attempt"
            ts_echo "${YELLOW}API overloaded, waiting ${RETRY_DELAY}s...${NC}"
            sleep $RETRY_DELAY
            ((attempt++))
            continue
        fi

        # Check for session limit
        if echo "$output" | grep -qiE "session.limit|concurrent|maximum.sessions"; then
            dev_log "WARN" "$phase hit session limit"
            ts_echo "${YELLOW}Session limit reached, waiting ${SESSION_WAIT}s...${NC}"
            sleep $SESSION_WAIT
            ((attempt++))
            continue
        fi

        # Other error - log and fail
        log_dev_failure "$phase" "$attempt" "$exit_code" "$output"
        ts_echo "${RED}$phase failed with exit code $exit_code${NC}"
        return $exit_code
    done

    dev_log "ERROR" "$phase failed after $MAX_RETRIES attempts"
    ts_echo "${RED}$phase failed after $MAX_RETRIES attempts${NC}"
    return 1
}

#------------------------------------------------------------------------------
# PROMPTS (loaded lazily to avoid issues on older bash)
#------------------------------------------------------------------------------

load_dev_prompts() {
    # Only load once
    [ -n "$PROMPTS_LOADED" ] && return 0
    PROMPTS_LOADED=1

read -r -d '' PLAN_PROMPT << 'PLAN_EOF' || true
# PLAN STEP - Create .task file

You are planning ONE task from TASKS.md.

## CRITICAL: You MUST create a .task file
Use the Write tool to create a file named ".task" in the current directory.
If you don't create this file, the automation will fail.

## Your Job
1. Read CONTEXT.md for project info and commands
2. Read TASKS.md - find the FIRST unchecked '- [ ]' task
   - **CRITICAL**: Only plan tasks marked '- [ ]' (unchecked)
   - Skip any task marked '- [x]' (already complete)
3. Search the codebase for existing patterns, utilities, components
4. **USE THE WRITE TOOL** to create .task file with the plan

## STOP: Verify Task Is Actually Unchecked
Before planning, CONFIRM the task line starts with '- [ ]' (space between brackets).
If it starts with '- [x]', it's ALREADY DONE - find the next unchecked task.

## Non-Actionable Tasks → TODO.md
If the task is NOT something that can be done via code/development, move it to TODO.md:
- Manual actions (e.g., "sign up for service", "email someone")
- External dependencies (e.g., "wait for API access", "get client approval")
- Human decisions (e.g., "decide on pricing", "review with team")
- Physical world actions (e.g., "purchase hardware", "schedule meeting")

To move a non-actionable task:
1. Remove it from TASKS.md (change '- [ ] task' to nothing)
2. Add it to TODO.md (create file if it doesn't exist)
3. Do NOT create a .task file for non-actionable tasks
4. Move to the next task in TASKS.md

## .task file format (MUST create this file):

TASK: [exact task text from TASKS.md]
ACTION: [what to implement]
EXPECTED_OUTCOME: [how to verify success]

EXISTING_CODE:
- [file/function to reuse]

PATTERNS:
- [pattern from codebase to follow]

PLAN:
1. [specific step]
2. [specific step]

FILES_TO_CREATE: [list or "none"]
FILES_TO_MODIFY: [list]
TEST_COMMAND: [from CONTEXT.md or detected]

OUTCOME_VERIFICATION:
- [specific check to confirm outcome]

## Rules
- REUSE existing code - search first
- Follow existing patterns in codebase
- DO NOT implement - just plan
- DO NOT delete or modify .task if it exists (read it first)
- **YOU MUST USE Write tool to create .task file**
PLAN_EOF

read -r -d '' EXECUTE_PROMPT << 'EXEC_EOF' || true
# EXECUTE STEP - Implement the plan

A .task file exists with the plan. Read it first, then implement.

## CRITICAL: First Steps
1. Read the .task file to see what needs to be done
2. The .task file contains: TASK, ACTION, PLAN steps, FILES_TO_MODIFY
3. Follow the PLAN steps exactly

## Rules
- Follow the PLAN steps in order
- Reuse code listed in EXISTING_CODE
- Follow PATTERNS for consistency
- Match existing code style in the project
- Handle errors meaningfully
- **DO NOT delete .task file** - it's needed for review

## When Implementation Done
1. Mark the task complete in TASKS.md: change '- [ ]' to '- [x]'
2. Commit changes: "feat: [brief task description]"
3. DO NOT delete .task - the review step needs it

If .task file doesn't exist, say "ERROR: No .task file found" and stop.
EXEC_EOF

read -r -d '' REVIEW_PROMPT << 'REVIEW_EOF' || true
# REVIEW STEP - Verify implementation

A .task file exists with the plan and expected outcome. Review against it.

## CRITICAL: First Steps
1. Read the .task file - it contains the plan and EXPECTED_OUTCOME
2. If .task doesn't exist, say "ERROR: No .task file found" and stop

## Verification Steps
1. Read EXPECTED_OUTCOME and OUTCOME_VERIFICATION from .task
2. Actually run the verification steps (compile, test, inspect)
3. Run TEST_COMMAND from .task file
4. Check that the task was marked complete in TASKS.md

## After Verification
Use the Edit tool to APPEND to the .task file (don't overwrite):

---
REVIEW_RESULT: [PASS or FAIL]
OUTCOME_VERIFIED: [yes/no - did the expected outcome happen?]
ISSUES:
- [specific issue or "None"]
FIX_PRIORITY:
1. [most critical issue]

## Output
- If PASS: Say "REVIEW_RESULT: PASS - no issues found"
- If FAIL: List the specific issues that need fixing

DO NOT delete .task file.
REVIEW_EOF

read -r -d '' FIX_PROMPT << 'FIX_EOF' || true
# FIX STEP - Address review issues

The .task file contains ISSUES from the review. Fix them.

## CRITICAL: First Steps
1. Read the .task file to see the ISSUES and FIX_PRIORITY
2. If .task doesn't exist, say "ERROR: No .task file found" and stop

## Fix Process
1. Fix issues in FIX_PRIORITY order (most critical first)
2. Run tests after each fix
3. Re-verify the EXPECTED_OUTCOME from .task

## After Fixing
Append to .task file:

FIX_APPLIED: [what you fixed]
TESTS_PASS: [yes/no]

## Output
- If fixed successfully: Say "FIX_APPLIED: [description]"
- If still failing: Describe what's still wrong

DO NOT delete .task file.
FIX_EOF
}

#------------------------------------------------------------------------------
# COMMANDS
#------------------------------------------------------------------------------

# Initialize project from idea file
dev_init() {
    local idea_file="$1"

    if [[ ! -f "$idea_file" ]]; then
        ts_echo "${RED}Error: Idea file '$idea_file' not found${NC}"
        return 1
    fi

    ts_echo "${GREEN}Initializing project from $idea_file...${NC}"

    local idea_content=$(cat "$idea_file")

    local init_prompt="You are initializing a new project.

Read this idea/requirements file and create:
1. CONTEXT.md - Project overview, tech stack, commands (test, build, run)
2. TASKS.md - Checklist of DEVELOPMENT tasks to build the project
3. TODO.md - (if needed) Non-development tasks requiring human action

## Idea File Content:
$idea_content

## CONTEXT.md Format:
# Project Name
Brief description

## Tech Stack
- [technology]: [purpose]

## Commands
- Test: [command]
- Build: [command]
- Run: [command]

## Architecture
[Key design decisions]

## TASKS.md Format (DEVELOPMENT TASKS ONLY):
# Tasks

## Phase 1: Setup
- [ ] Task description - Expected outcome

## Phase 2: Core Features
- [ ] Task description - Expected outcome

(continue phases as needed)

## TODO.md Format (NON-DEVELOPMENT TASKS):
# TODO

## Setup (Manual)
- [ ] Sign up for [service]
- [ ] Get API key for [service]

## External Dependencies
- [ ] Wait for [external thing]

(only create if there are non-dev tasks)

## Task Classification:
**TASKS.md** - Development tasks that CAN be automated by AI:
- Code changes, feature implementation, bug fixes
- Writing tests, updating configs, refactoring
- Database migrations, API integrations

**TODO.md** - Tasks that CANNOT be done by AI (require human):
- Sign up for external services / get credentials
- Manual testing, stakeholder reviews
- Physical world actions, external dependencies

## Rules:
- Tasks should be small, focused
- Each task has clear outcome to verify
- Order by dependencies
- Include setup tasks first
- Non-development tasks go to TODO.md, not TASKS.md"

    run_claude_dev "$init_prompt" "init"

    ts_echo "${GREEN}Project initialized! Run 'pauly dev' to start building.${NC}"
}

# Refresh tasks from notes
dev_refresh() {
    local notes_file="$1"

    if [[ ! -f "$notes_file" ]]; then
        ts_echo "${RED}Error: Notes file '$notes_file' not found${NC}"
        return 1
    fi

    ts_echo "${GREEN}Adding tasks from $notes_file...${NC}"

    local notes_content=$(cat "$notes_file")
    local context_content=""
    local tasks_content=""

    [[ -f "$CONTEXT_FILE" ]] && context_content=$(cat "$CONTEXT_FILE")
    [[ -f "$TASK_FILE" ]] && tasks_content=$(cat "$TASK_FILE")

    local refresh_prompt="You are adding new tasks to an existing project.

## Current CONTEXT.md:
$context_content

## Current TASKS.md:
$tasks_content

## New Notes/Ideas:
$notes_content

## Your Job:
1. Read the new notes
2. Convert them into actionable tasks
3. Add DEVELOPMENT tasks to TASKS.md in the appropriate phase
4. Add NON-DEVELOPMENT tasks to TODO.md (create if needed)
5. Update CONTEXT.md if there are new architectural decisions

## Task Classification:
**TASKS.md** - Development tasks that can be automated:
- Code changes, feature implementation, bug fixes
- Writing tests, updating configs, refactoring
- Database migrations, API integrations
- Documentation updates within the codebase

**TODO.md** - Non-development tasks requiring human action:
- Sign up for external services
- Get API keys or credentials
- Manual testing/review by humans
- Decisions requiring stakeholder input
- Physical world actions (meetings, purchases)
- External dependencies (waiting for others)

## Rules:
- Keep existing completed tasks in TASKS.md
- Add development tasks with '- [ ]' format to TASKS.md
- Add non-development tasks to TODO.md
- Each task needs clear outcome
- Maintain task ordering by dependency"

    run_claude_dev "$refresh_prompt" "refresh"

    ts_echo "${GREEN}Tasks refreshed!${NC}"
}

# Main development loop
dev_loop() {
    load_dev_prompts

    local max_iterations="${1:-25}"
    local iteration=1
    local start_time=$(date +%s)

    ts_echo "${GREEN}Starting development loop (max $max_iterations iterations)${NC}"
    ts_echo "${CYAN}Loop: PLAN -> EXECUTE -> REVIEW -> FIX${NC}"
    echo ""

    while [[ $iteration -le $max_iterations ]]; do
        ts_echo "${GREEN}=== Iteration $iteration/$max_iterations ===${NC}"

        # Check if all tasks are done
        if [[ -f "$TASK_FILE" ]]; then
            local unchecked
            unchecked=$(grep -c '^\s*- \[ \]' "$TASK_FILE" 2>/dev/null | head -1 || echo "0")
            unchecked="${unchecked//[^0-9]/}"  # Strip non-numeric chars
            [[ -z "$unchecked" ]] && unchecked=0
            if [[ "$unchecked" -eq 0 ]]; then
                ts_echo "${GREEN}All tasks complete!${NC}"
                send_dev_notification "complete" "$iteration" "$start_time"
                break
            fi
            ts_echo "${BLUE}Remaining tasks: $unchecked${NC}"
        fi

        # Clean up any stale .task file from previous iterations
        rm -f "$TASK_STATE"

        # PLAN (fresh session - reads CONTEXT.md and TASKS.md)
        ts_echo "${CYAN}[PLAN]${NC}"
        run_claude_dev "$PLAN_PROMPT" "PLAN" "false" || {
            ts_echo "${RED}Plan failed, stopping${NC}"
            send_dev_notification "failed" "$iteration" "$start_time" "Plan phase failed"
            break
        }

        # Check if .task was created and has required content
        if [[ ! -f "$TASK_STATE" ]]; then
            ts_echo "${YELLOW}No .task file created - may be done${NC}"
            send_dev_notification "complete" "$iteration" "$start_time"
            break
        fi

        # Validate .task has required fields
        if ! grep -q "^TASK:" "$TASK_STATE" 2>/dev/null; then
            ts_echo "${RED}.task file missing TASK: field - invalid plan${NC}"
            rm -f "$TASK_STATE"
            continue
        fi

        # EXECUTE (continues from PLAN - has full context)
        ts_echo "${CYAN}[EXECUTE]${NC}"
        run_claude_dev "$EXECUTE_PROMPT" "EXECUTE" "true" || {
            ts_echo "${RED}Execute failed${NC}"
        }

        # REVIEW (continues from EXECUTE - knows what was implemented)
        ts_echo "${CYAN}[REVIEW]${NC}"
        run_claude_dev "$REVIEW_PROMPT" "REVIEW" "true" || {
            ts_echo "${RED}Review failed${NC}"
        }

        # Check if review passed
        if grep -q "REVIEW_RESULT: PASS" "$TASK_STATE" 2>/dev/null; then
            ts_echo "${GREEN}Review passed!${NC}"
            rm -f "$TASK_STATE"
        else
            # FIX (continues from REVIEW - knows what issues were found)
            ts_echo "${CYAN}[FIX]${NC}"
            run_claude_dev "$FIX_PROMPT" "FIX" "true" || {
                ts_echo "${RED}Fix failed${NC}"
            }
            rm -f "$TASK_STATE"
        fi

        # Commit and push changes after each iteration
        if command -v git &> /dev/null && [[ -d .git ]]; then
            if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
                ts_echo "${BLUE}Committing and pushing changes...${NC}"
                git add -A
                git commit -m "feat: iteration $iteration - automated development" 2>/dev/null || true
                git push 2>/dev/null || git push -u origin "$(git branch --show-current)" 2>/dev/null || true
                dev_log "INFO" "Changes committed and pushed for iteration $iteration"
            fi
        fi

        ((iteration++))
        echo ""
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    ts_echo "${GREEN}Development loop complete after $((iteration-1)) iterations (${duration}s)${NC}"
}

# Isolated task mode
dev_task() {
    local task_desc="$1"
    local branch_name="$2"
    local no_pr="$3"
    local max_iter="${4:-25}"
    local task_file="$5"

    # Read task from file if specified
    if [[ -n "$task_file" && -f "$task_file" ]]; then
        task_desc=$(cat "$task_file")
    fi

    if [[ -z "$task_desc" ]]; then
        ts_echo "${RED}Error: No task description provided${NC}"
        echo "Usage: pauly dev task \"description\" or pauly dev task -f file.md"
        return 1
    fi

    ts_echo "${GREEN}Starting isolated task mode${NC}"
    ts_echo "${BLUE}Task: ${task_desc:0:80}...${NC}"

    # Create task directory
    local task_id=$(date +%s)
    local task_dir="$DEV_TASK_DIR/$task_id"
    mkdir -p "$task_dir"

    # Create branch if git available
    local branch=""
    if command -v git &> /dev/null && [[ -d .git ]]; then
        branch="${branch_name:-task-$task_id}"
        git checkout -b "$branch" 2>/dev/null || git checkout "$branch" 2>/dev/null || true
        ts_echo "${BLUE}Working on branch: $branch${NC}"
    fi

    # Write task state
    echo "TASK: $task_desc" > "$task_dir/.task"

    # Run iterations
    local iter=1
    local completed=false
    while [[ $iter -le $max_iter ]]; do
        ts_echo "${CYAN}[Task iteration $iter/$max_iter]${NC}"

        local task_prompt="You are working on a single isolated task.

TASK: $task_desc

Read the codebase, implement the task, test it, and verify it works.
When done, say 'TASK COMPLETE'.

If you encounter blockers, document them and say 'TASK BLOCKED: [reason]'."

        local output=$(run_claude_dev "$task_prompt" "task-$iter")

        if echo "$output" | grep -qi "TASK COMPLETE"; then
            ts_echo "${GREEN}Task completed!${NC}"
            completed=true

            # Always commit and push changes if git available
            if command -v git &> /dev/null && [[ -d .git ]]; then
                if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
                    ts_echo "${BLUE}Committing and pushing changes...${NC}"
                    git add -A
                    git commit -m "feat: ${task_desc:0:50}" 2>/dev/null || true
                    if [[ -n "$branch" ]]; then
                        git push -u origin "$branch" 2>/dev/null || true
                    else
                        git push 2>/dev/null || git push -u origin "$(git branch --show-current)" 2>/dev/null || true
                    fi
                fi
            fi

            # Create PR if gh available and not disabled
            if [[ "$no_pr" != "true" ]] && command -v gh &> /dev/null && [[ -n "$branch" ]]; then
                ts_echo "${BLUE}Creating PR...${NC}"
                gh pr create --title "${task_desc:0:72}" --body "Automated task completion by Pauly

## Task
$task_desc

---
Generated by \`pauly dev task\`" 2>/dev/null || true
            fi
            break
        fi

        if echo "$output" | grep -qi "TASK BLOCKED"; then
            ts_echo "${RED}Task blocked${NC}"
            echo "$output" | grep -i "TASK BLOCKED" > "$task_dir/blocked.txt"
            break
        fi

        ((iter++))
    done

    ts_echo "${GREEN}Task mode complete${NC}"
    [[ "$completed" == "true" ]]
}

# Send email notification about dev progress
send_dev_notification() {
    local status="$1"
    local iterations="$2"
    local start_time="$3"
    local error_msg="${4:-}"

    # Only send if email is configured
    [[ -z "$EMAIL" ]] && return 0

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local project_name=$(basename "$(pwd)")

    local subject=""
    local body=""

    case "$status" in
        complete)
            subject="Pauly Dev Complete: $project_name"
            body="Development loop completed successfully.

Project: $project_name
Iterations: $iterations
Duration: ${duration}s

Remaining tasks:"
            if [[ -f "$TASK_FILE" ]]; then
                body+="
$(grep '^\s*- \[ \]' "$TASK_FILE" 2>/dev/null | head -10)"
            fi
            ;;
        failed)
            subject="Pauly Dev Failed: $project_name"
            body="Development loop encountered an error.

Project: $project_name
Iteration: $iterations
Duration: ${duration}s
Error: $error_msg

Check logs at: $DEV_LOG_DIR/"
            ;;
    esac

    echo "$body" | mail -s "$subject" "$EMAIL" 2>/dev/null || true
}

# Show dev status
dev_status() {
    ts_echo "${BOLD}Development Status${NC}"
    echo ""

    # Check for TASKS.md
    if [[ -f "$TASK_FILE" ]]; then
        local total=$(grep -c '^\s*- \[' "$TASK_FILE" 2>/dev/null || echo "0")
        local completed=$(grep -c '^\s*- \[x\]' "$TASK_FILE" 2>/dev/null || echo "0")
        local remaining=$((total - completed))

        ts_echo "${CYAN}Tasks:${NC}"
        echo "  Total: $total"
        echo "  Completed: $completed"
        echo "  Remaining: $remaining"
        echo ""

        if [[ $remaining -gt 0 ]]; then
            ts_echo "${CYAN}Next tasks:${NC}"
            grep '^\s*- \[ \]' "$TASK_FILE" 2>/dev/null | head -5 | while read -r line; do
                echo "  $line"
            done
            echo ""
        fi
    else
        ts_echo "${YELLOW}No TASKS.md found. Run 'pauly dev init <idea.md>' to start.${NC}"
    fi

    # Check for context
    if [[ -f "$CONTEXT_FILE" ]]; then
        ts_echo "${GREEN}CONTEXT.md exists${NC}"
    fi

    # Check for active task
    if [[ -f "$TASK_STATE" ]]; then
        echo ""
        ts_echo "${YELLOW}Active task in progress:${NC}"
        head -3 "$TASK_STATE"
    fi

    # Show recent logs
    if [[ -d "$DEV_LOG_DIR" ]]; then
        local latest_log=$(ls -t "$DEV_LOG_DIR"/*.log 2>/dev/null | head -1)
        if [[ -n "$latest_log" ]]; then
            echo ""
            ts_echo "${CYAN}Recent activity:${NC}"
            tail -5 "$latest_log" 2>/dev/null
        fi
    fi
}
