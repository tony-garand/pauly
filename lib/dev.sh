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
    echo -e "${YELLOW}  Failure details saved to: $fail_file${NC}"
}

# Check for Claude CLI
ensure_claude_dev() {
    if ! command -v claude &> /dev/null; then
        echo -e "${RED}Error: Claude CLI not found${NC}"
        echo "Install with: npm install -g @anthropic-ai/claude-code"
        return 1
    fi
}

# Run Claude with retry logic and session limit handling
run_claude_dev() {
    local prompt="$1"
    local phase="$2"
    local attempt=1
    local output=""
    local exit_code=0

    dev_log "INFO" "Starting $phase"

    while [[ $attempt -le $MAX_RETRIES ]]; do
        echo -e "${BLUE}  Running $phase (attempt $attempt/$MAX_RETRIES)...${NC}"

        set +e
        output=$(claude --dangerously-skip-permissions -p "$prompt" 2>&1)
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
            echo -e "${YELLOW}  API overloaded, waiting ${RETRY_DELAY}s...${NC}"
            sleep $RETRY_DELAY
            ((attempt++))
            continue
        fi

        # Check for session limit
        if echo "$output" | grep -qiE "session.limit|concurrent|maximum.sessions"; then
            dev_log "WARN" "$phase hit session limit"
            echo -e "${YELLOW}  Session limit reached, waiting ${SESSION_WAIT}s...${NC}"
            sleep $SESSION_WAIT
            ((attempt++))
            continue
        fi

        # Other error - log and fail
        log_dev_failure "$phase" "$attempt" "$exit_code" "$output"
        echo -e "${RED}  $phase failed with exit code $exit_code${NC}"
        return $exit_code
    done

    dev_log "ERROR" "$phase failed after $MAX_RETRIES attempts"
    echo -e "${RED}  $phase failed after $MAX_RETRIES attempts${NC}"
    return 1
}

#------------------------------------------------------------------------------
# PROMPTS
#------------------------------------------------------------------------------

read -r -d '' PLAN_PROMPT << 'PLAN_EOF' || true
# PLAN STEP

You are planning ONE task from TASKS.md.

## Your Job
1. Read CONTEXT.md for project info and commands
2. Read TASKS.md - find the FIRST unchecked '- [ ]' task
   - **CRITICAL**: Only plan tasks marked '- [ ]' (unchecked)
   - Skip any task marked '- [x]' (already complete)
3. **Parse the task**: Extract ACTION and OUTCOME (format: 'Action - Outcome')
4. Search the codebase for existing patterns, utilities, components
5. Write a plan to .task file

## STOP: Verify Task Is Actually Unchecked
Before planning, CONFIRM the task line starts with '- [ ]' (space between brackets).
If it starts with '- [x]', it's ALREADY DONE - do not plan it.

## Write to .task file:

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

FILES_TO_CREATE: [list]
FILES_TO_MODIFY: [list]
TEST_COMMAND: [from CONTEXT.md or detected]

OUTCOME_VERIFICATION:
- [specific check to confirm outcome]
- [curl command, file check, or code inspection]

## Architecture Principles
- REUSE existing code - search first
- EXTEND existing files when logical
- Follow existing patterns in codebase
- Match existing code style

DO NOT implement. Just plan.
PLAN_EOF

read -r -d '' EXECUTE_PROMPT << 'EXEC_EOF' || true
# EXECUTE STEP

Read .task file. Follow the plan exactly.

## Rules
- Follow the PLAN steps in order
- Reuse code listed in EXISTING_CODE
- Follow PATTERNS for consistency
- Match existing code style in the project
- Handle errors meaningfully

## When Done
Mark the task complete in TASKS.md:
- Simple completion: '- [x] Task description'
- With note: '- [x] Task description - Note: [insight]'

Then commit: "feat: [task description]"
EXEC_EOF

read -r -d '' REVIEW_PROMPT << 'REVIEW_EOF' || true
# REVIEW STEP

Review implementation against .task plan.

## 1. VERIFY OUTCOME FIRST
Read EXPECTED_OUTCOME and OUTCOME_VERIFICATION from .task file.
Actually run the verification steps to confirm the outcome was achieved.

**If outcome NOT achieved**: This is a BLOCKER - the task isn't done.

## 2. Test Verification
Run the TEST_COMMAND from .task file.
- Check for compilation errors
- Check for test failures

## 3. Code Quality
- Patterns followed from .task?
- Code reused as planned?

## Output Format
Append to .task file:

REVIEW_RESULT: [PASS or FAIL]
OUTCOME_VERIFIED: [yes/no]
ISSUES:
- [specific issue or "None"]
FIX_PRIORITY:
1. [most critical]
2. [test failures]

If PASS: Say "Review complete - no issues found"
If FAIL: List specific issues to fix
REVIEW_EOF

read -r -d '' FIX_PROMPT << 'FIX_EOF' || true
# FIX STEP

Read ISSUES from .task file. Fix them in priority order.

## Rules
1. Fix ONLY listed issues
2. Re-verify outcome after fixes
3. Run tests after changes
4. Update .task with FIX_APPLIED: [what you fixed]

If tests still fail after fix, note what else might be wrong.
FIX_EOF

#------------------------------------------------------------------------------
# COMMANDS
#------------------------------------------------------------------------------

# Initialize project from idea file
dev_init() {
    local idea_file="$1"

    if [[ ! -f "$idea_file" ]]; then
        echo -e "${RED}Error: Idea file '$idea_file' not found${NC}"
        return 1
    fi

    echo -e "${GREEN}Initializing project from $idea_file...${NC}"

    local idea_content=$(cat "$idea_file")

    local init_prompt="You are initializing a new project.

Read this idea/requirements file and create:
1. CONTEXT.md - Project overview, tech stack, commands (test, build, run)
2. TASKS.md - Checklist of tasks to build the project, ordered by dependency

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

## TASKS.md Format:
# Tasks

## Phase 1: Setup
- [ ] Task description - Expected outcome

## Phase 2: Core Features
- [ ] Task description - Expected outcome

(continue phases as needed)

## Rules:
- Tasks should be small, focused
- Each task has clear outcome to verify
- Order by dependencies
- Include setup tasks first"

    run_claude_dev "$init_prompt" "init"

    echo -e "${GREEN}Project initialized! Run 'pauly dev' to start building.${NC}"
}

# Refresh tasks from notes
dev_refresh() {
    local notes_file="$1"

    if [[ ! -f "$notes_file" ]]; then
        echo -e "${RED}Error: Notes file '$notes_file' not found${NC}"
        return 1
    fi

    echo -e "${GREEN}Adding tasks from $notes_file...${NC}"

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
3. Add them to TASKS.md in the appropriate phase
4. Update CONTEXT.md if there are new architectural decisions

## Rules:
- Keep existing completed tasks
- Add new tasks with '- [ ]' format
- Each task needs clear outcome
- Maintain task ordering by dependency"

    run_claude_dev "$refresh_prompt" "refresh"

    echo -e "${GREEN}Tasks refreshed!${NC}"
}

# Main development loop
dev_loop() {
    local max_iterations="${1:-25}"
    local iteration=1
    local start_time=$(date +%s)

    echo -e "${GREEN}Starting development loop (max $max_iterations iterations)${NC}"
    echo -e "${CYAN}Loop: PLAN -> EXECUTE -> REVIEW -> FIX${NC}"
    echo ""

    while [[ $iteration -le $max_iterations ]]; do
        echo -e "${GREEN}=== Iteration $iteration/$max_iterations ===${NC}"

        # Check if all tasks are done
        if [[ -f "$TASK_FILE" ]]; then
            local unchecked=$(grep -c '^\s*- \[ \]' "$TASK_FILE" 2>/dev/null || echo "0")
            if [[ "$unchecked" -eq 0 ]]; then
                echo -e "${GREEN}All tasks complete!${NC}"
                send_dev_notification "complete" "$iteration" "$start_time"
                break
            fi
            echo -e "${BLUE}  Remaining tasks: $unchecked${NC}"
        fi

        # PLAN
        echo -e "${CYAN}[PLAN]${NC}"
        run_claude_dev "$PLAN_PROMPT" "PLAN" || {
            echo -e "${RED}Plan failed, stopping${NC}"
            send_dev_notification "failed" "$iteration" "$start_time" "Plan phase failed"
            break
        }

        # Check if .task was created
        if [[ ! -f "$TASK_STATE" ]]; then
            echo -e "${YELLOW}No .task file created - may be done${NC}"
            send_dev_notification "complete" "$iteration" "$start_time"
            break
        fi

        # EXECUTE
        echo -e "${CYAN}[EXECUTE]${NC}"
        run_claude_dev "$EXECUTE_PROMPT" "EXECUTE" || {
            echo -e "${RED}Execute failed${NC}"
        }

        # REVIEW
        echo -e "${CYAN}[REVIEW]${NC}"
        run_claude_dev "$REVIEW_PROMPT" "REVIEW" || {
            echo -e "${RED}Review failed${NC}"
        }

        # Check if review passed
        if grep -q "REVIEW_RESULT: PASS" "$TASK_STATE" 2>/dev/null; then
            echo -e "${GREEN}  Review passed!${NC}"
            rm -f "$TASK_STATE"
        else
            # FIX
            echo -e "${CYAN}[FIX]${NC}"
            run_claude_dev "$FIX_PROMPT" "FIX" || {
                echo -e "${RED}Fix failed${NC}"
            }
            rm -f "$TASK_STATE"
        fi

        ((iteration++))
        echo ""
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "${GREEN}Development loop complete after $((iteration-1)) iterations (${duration}s)${NC}"
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
        echo -e "${RED}Error: No task description provided${NC}"
        echo "Usage: pauly dev task \"description\" or pauly dev task -f file.md"
        return 1
    fi

    echo -e "${GREEN}Starting isolated task mode${NC}"
    echo -e "${BLUE}Task: ${task_desc:0:80}...${NC}"

    # Create task directory
    local task_id=$(date +%s)
    local task_dir="$DEV_TASK_DIR/$task_id"
    mkdir -p "$task_dir"

    # Create branch if git available
    local branch=""
    if command -v git &> /dev/null && [[ -d .git ]]; then
        branch="${branch_name:-task-$task_id}"
        git checkout -b "$branch" 2>/dev/null || git checkout "$branch" 2>/dev/null || true
        echo -e "${BLUE}  Working on branch: $branch${NC}"
    fi

    # Write task state
    echo "TASK: $task_desc" > "$task_dir/.task"

    # Run iterations
    local iter=1
    local completed=false
    while [[ $iter -le $max_iter ]]; do
        echo -e "${CYAN}[Task iteration $iter/$max_iter]${NC}"

        local task_prompt="You are working on a single isolated task.

TASK: $task_desc

Read the codebase, implement the task, test it, and verify it works.
When done, say 'TASK COMPLETE'.

If you encounter blockers, document them and say 'TASK BLOCKED: [reason]'."

        local output=$(run_claude_dev "$task_prompt" "task-$iter")

        if echo "$output" | grep -qi "TASK COMPLETE"; then
            echo -e "${GREEN}Task completed!${NC}"
            completed=true

            # Create PR if git/gh available and not disabled
            if [[ "$no_pr" != "true" ]] && command -v gh &> /dev/null && [[ -n "$branch" ]]; then
                echo -e "${BLUE}Creating PR...${NC}"
                git add -A
                git commit -m "feat: ${task_desc:0:50}" 2>/dev/null || true
                git push -u origin "$branch" 2>/dev/null || true
                gh pr create --title "${task_desc:0:72}" --body "Automated task completion by Pauly

## Task
$task_desc

---
Generated by \`pauly dev task\`" 2>/dev/null || true
            fi
            break
        fi

        if echo "$output" | grep -qi "TASK BLOCKED"; then
            echo -e "${RED}Task blocked${NC}"
            echo "$output" | grep -i "TASK BLOCKED" > "$task_dir/blocked.txt"
            break
        fi

        ((iter++))
    done

    echo -e "${GREEN}Task mode complete${NC}"
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
    echo -e "${BOLD}Development Status${NC}"
    echo ""

    # Check for TASKS.md
    if [[ -f "$TASK_FILE" ]]; then
        local total=$(grep -c '^\s*- \[' "$TASK_FILE" 2>/dev/null || echo "0")
        local completed=$(grep -c '^\s*- \[x\]' "$TASK_FILE" 2>/dev/null || echo "0")
        local remaining=$((total - completed))

        echo -e "${CYAN}Tasks:${NC}"
        echo "  Total: $total"
        echo "  Completed: $completed"
        echo "  Remaining: $remaining"
        echo ""

        if [[ $remaining -gt 0 ]]; then
            echo -e "${CYAN}Next tasks:${NC}"
            grep '^\s*- \[ \]' "$TASK_FILE" 2>/dev/null | head -5 | while read -r line; do
                echo "  $line"
            done
            echo ""
        fi
    else
        echo -e "${YELLOW}No TASKS.md found. Run 'pauly dev init <idea.md>' to start.${NC}"
    fi

    # Check for context
    if [[ -f "$CONTEXT_FILE" ]]; then
        echo -e "${GREEN}CONTEXT.md exists${NC}"
    fi

    # Check for active task
    if [[ -f "$TASK_STATE" ]]; then
        echo ""
        echo -e "${YELLOW}Active task in progress:${NC}"
        head -3 "$TASK_STATE"
    fi

    # Show recent logs
    if [[ -d "$DEV_LOG_DIR" ]]; then
        local latest_log=$(ls -t "$DEV_LOG_DIR"/*.log 2>/dev/null | head -1)
        if [[ -n "$latest_log" ]]; then
            echo ""
            echo -e "${CYAN}Recent activity:${NC}"
            tail -5 "$latest_log" 2>/dev/null
        fi
    fi
}
