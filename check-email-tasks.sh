#!/bin/bash

# Email Task Runner
# Checks inbox for task emails and executes them via Claude

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Email settings from config
IMAP_HOST="${IMAP_HOST:-imap.gmail.com}"
IMAP_PORT="${IMAP_PORT:-993}"
IMAP_USER="${SMTP_USER}"
IMAP_PASSWORD="${SMTP_PASSWORD}"
ALLOWED_SENDERS="${ALLOWED_SENDERS:-$EMAIL}"

# Process control commands from email (stop-all, status, etc.)
# Returns: 0 if command was handled, 1 if not a control command
process_control_command() {
    local cmd="$1"
    local body="$2"

    case "$cmd" in
        stop-all|stop|kill)
            log "Running: pauly kill (from email)"
            "$SCRIPT_DIR/pauly" kill 2>&1
            echo ""
            echo "All Claude and Pauly processes stopped."
            return 0
            ;;

        status)
            log "Running: pauly status (from email)"
            "$SCRIPT_DIR/pauly" status 2>&1
            return 0
            ;;

        admin\ start|admin-start)
            log "Running: pauly admin start (from email)"
            "$SCRIPT_DIR/pauly" admin start 2>&1
            return 0
            ;;

        admin\ stop|admin-stop)
            log "Running: pauly admin stop (from email)"
            "$SCRIPT_DIR/pauly" admin stop 2>&1
            return 0
            ;;

        admin\ restart|admin-restart)
            log "Running: pauly admin restart (from email)"
            "$SCRIPT_DIR/pauly" admin restart 2>&1
            return 0
            ;;

        admin\ status|admin-status)
            log "Running: pauly admin status (from email)"
            "$SCRIPT_DIR/pauly" admin status 2>&1
            return 0
            ;;

        logs|logs\ *)
            local job=$(echo "$cmd" | awk '{print $2}')
            log "Running: pauly logs $job (from email)"
            "$SCRIPT_DIR/pauly" logs "$job" 2>&1 | tail -100
            return 0
            ;;

        help|commands)
            echo "Available Pauly email commands:"
            echo ""
            echo "Control Commands:"
            echo "  stop-all, stop, kill  - Stop all Claude/Pauly processes"
            echo "  status                - Show Pauly status"
            echo "  admin start           - Start admin dashboard"
            echo "  admin stop            - Stop admin dashboard"
            echo "  admin restart         - Restart admin dashboard"
            echo "  logs [job]            - View logs (last 100 lines)"
            echo ""
            echo "Dev Commands:"
            echo "  dev init              - Create project from email body"
            echo "  dev task              - Run task from email body"
            echo "  dev [N]               - Run N iterations (default: 25)"
            echo "  dev status            - Show dev progress"
            echo ""
            echo "GitHub Issues:"
            echo "  Paste a GitHub issue URL in subject or body"
            echo "  e.g., https://github.com/owner/repo/issues/123"
            echo ""
            echo "Regular Tasks:"
            echo "  Any other subject will be executed as a Claude task"
            return 0
            ;;

        *)
            return 1  # Not a control command
            ;;
    esac
}

# Process GitHub issue links from email
# Extracts issue URL and works on it like the GitHub tasks processor
process_github_issue() {
    local subject="$1"
    local body="$2"

    # Look for GitHub issue URL in subject or body
    local issue_url=""
    local url_pattern='https://github\.com/([^/]+)/([^/]+)/issues/([0-9]+)'

    # Check subject first
    if [[ "$subject" =~ $url_pattern ]]; then
        issue_url="${BASH_REMATCH[0]}"
    # Then check body
    elif [[ "$body" =~ $url_pattern ]]; then
        issue_url="${BASH_REMATCH[0]}"
    else
        return 1  # No GitHub issue URL found
    fi

    # Extract owner, repo, and issue number
    if [[ "$issue_url" =~ https://github\.com/([^/]+)/([^/]+)/issues/([0-9]+) ]]; then
        local owner="${BASH_REMATCH[1]}"
        local repo="${BASH_REMATCH[2]}"
        local issue_num="${BASH_REMATCH[3]}"

        log "Processing GitHub issue: $owner/$repo#$issue_num"

        # Fetch issue details using gh CLI
        if ! command -v gh &> /dev/null; then
            echo "Error: GitHub CLI (gh) not installed"
            return 1
        fi

        local issue_title issue_body issue_labels
        issue_title=$(gh issue view "$issue_num" --repo "$owner/$repo" --json title -q '.title' 2>&1)
        issue_body=$(gh issue view "$issue_num" --repo "$owner/$repo" --json body -q '.body' 2>&1)
        issue_labels=$(gh issue view "$issue_num" --repo "$owner/$repo" --json labels -q '.labels[].name' 2>&1)

        if [[ "$issue_title" == *"error"* ]] || [[ -z "$issue_title" ]]; then
            echo "Error fetching issue: $issue_title"
            return 1
        fi

        echo "Issue: $issue_title"
        echo "Labels: $issue_labels"
        echo ""

        # Determine target project from labels or repo name
        local project_name=""
        for label in $issue_labels; do
            if [[ "$label" =~ ^project:(.+)$ ]] || [[ "$label" =~ ^product:(.+)$ ]]; then
                project_name="${BASH_REMATCH[1]}"
                break
            fi
        done

        # Fall back to repo name if no project label
        [ -z "$project_name" ] && project_name="$repo"

        local project_path="${PROJECTS_DIR:-$HOME/Projects}/$project_name"

        if [ ! -d "$project_path" ]; then
            echo "Project not found: $project_path"
            echo "Create the project first or use a project: label on the issue."
            return 1
        fi

        cd "$project_path"
        echo "Working in: $project_path"
        echo ""

        # Execute the issue as a task
        local result
        result=$(claude --dangerously-skip-permissions -p "Work on this GitHub issue:

Issue #$issue_num: $issue_title

Description:
$issue_body

Repository: $owner/$repo
Project Directory: $project_path

Please analyze this issue and implement the necessary changes. Provide a summary of what you did." 2>&1)

        echo "$result"

        # Add comment to the issue with results
        local comment="🤖 **Pauly processed this issue via email**

**Summary:**
$(echo "$result" | tail -50)

---
_Automated by [Pauly](https://github.com/tony-garand/pauly)_"

        gh issue comment "$issue_num" --repo "$owner/$repo" --body "$comment" 2>&1 || true

        return 0
    fi

    return 1
}

# Process dev commands from email
# Usage: process_dev_command "dev init" "idea content" "/tmp/dir"
process_dev_command() {
    local cmd="$1"
    local body="$2"
    local temp_dir="$3"

    # Parse the dev subcommand
    local subcmd=$(echo "$cmd" | awk '{print $2}')
    local args=$(echo "$cmd" | cut -d' ' -f3-)

    case "$subcmd" in
        init)
            # Create idea file from email body and run init
            local idea_file="$temp_dir/idea.md"
            echo "$body" > "$idea_file"

            log "Running: pauly dev init (from email)"
            cd "${PROJECTS_DIR:-$HOME/Projects}"

            # Create project directory from first line of idea
            local project_name=$(echo "$body" | head -1 | tr -dc '[:alnum:] ' | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-30)
            [ -z "$project_name" ] && project_name="email-project-$(date +%s)"

            mkdir -p "$project_name"
            cd "$project_name"

            "$SCRIPT_DIR/pauly" dev init "$idea_file" 2>&1
            echo ""
            echo "Project initialized at: $(pwd)"
            echo "Run 'pauly dev' in this directory to start building."
            ;;

        task)
            # Run isolated task mode with body as description
            local task_desc="${body:-$args}"
            log "Running: pauly dev task (from email)"

            # Need to be in a project directory
            if [ -n "$DEV_PROJECT_DIR" ] && [ -d "$DEV_PROJECT_DIR" ]; then
                cd "$DEV_PROJECT_DIR"
            else
                echo "Error: No project directory configured for dev tasks."
                echo "Set DEV_PROJECT_DIR in your config or include the project path in your email."
                return 1
            fi

            "$SCRIPT_DIR/pauly" dev task "$task_desc" 2>&1
            ;;

        status|st)
            # Show dev status
            if [ -n "$DEV_PROJECT_DIR" ] && [ -d "$DEV_PROJECT_DIR" ]; then
                cd "$DEV_PROJECT_DIR"
            fi
            "$SCRIPT_DIR/pauly" dev status 2>&1
            ;;

        [0-9]*)
            # Run N iterations: "dev 10" -> run 10 iterations
            local iterations="$subcmd"
            log "Running: pauly dev $iterations (from email)"

            if [ -n "$DEV_PROJECT_DIR" ] && [ -d "$DEV_PROJECT_DIR" ]; then
                cd "$DEV_PROJECT_DIR"
            else
                echo "Error: No project directory configured."
                echo "Set DEV_PROJECT_DIR in your config."
                return 1
            fi

            "$SCRIPT_DIR/pauly" dev "$iterations" 2>&1
            ;;

        ""|run)
            # Default: run dev loop with default iterations
            local iterations="${args:-25}"
            log "Running: pauly dev $iterations (from email)"

            if [ -n "$DEV_PROJECT_DIR" ] && [ -d "$DEV_PROJECT_DIR" ]; then
                cd "$DEV_PROJECT_DIR"
            else
                echo "Error: No project directory configured."
                echo "Set DEV_PROJECT_DIR in your config."
                return 1
            fi

            "$SCRIPT_DIR/pauly" dev "$iterations" 2>&1
            ;;

        *)
            echo "Unknown dev command: $subcmd"
            echo ""
            echo "Available email dev commands:"
            echo "  dev init     - Body contains the project idea"
            echo "  dev task     - Body contains the task description"
            echo "  dev 10       - Run 10 iterations"
            echo "  dev          - Run default iterations"
            echo "  dev status   - Show development progress"
            return 1
            ;;
    esac
}

main() {
    log "Checking for email tasks..."

    ensure_claude || return 1

    # Check if required config exists
    if [ -z "$IMAP_USER" ] || [ -z "$IMAP_PASSWORD" ]; then
        log_error "IMAP credentials not configured. Run 'pauly config' first."
        return 1
    fi

    # Create temp directory for email processing
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # Fetch unread emails from allowed senders using Python (more reliable than curl for IMAP)
    # Pass credentials via environment to avoid escaping issues
    IMAP_HOST="$IMAP_HOST" \
    IMAP_PORT="$IMAP_PORT" \
    IMAP_USER="$IMAP_USER" \
    IMAP_PASSWORD="$IMAP_PASSWORD" \
    ALLOWED_SENDERS="$ALLOWED_SENDERS" \
    TEMP_DIR="$temp_dir" \
    python3 << 'PYTHON_SCRIPT'
import imaplib
import email
from email.header import decode_header
import os
import sys

imap_host = os.environ.get("IMAP_HOST", "imap.gmail.com")
imap_port = int(os.environ.get("IMAP_PORT", "993"))
username = os.environ.get("IMAP_USER", "")
password = os.environ.get("IMAP_PASSWORD", "")
allowed_senders = os.environ.get("ALLOWED_SENDERS", "").lower().split(",")
temp_dir = os.environ.get("TEMP_DIR", "/tmp")

try:
    # Connect to IMAP
    mail = imaplib.IMAP4_SSL(imap_host, imap_port)
    mail.login(username, password)
    mail.select("INBOX")

    # Search for unread emails (no subject prefix required - sender validation provides security)
    status, messages = mail.search(None, 'UNSEEN')

    if status != "OK":
        print("No messages found", file=sys.stderr)
        sys.exit(0)

    email_ids = messages[0].split()
    task_count = 0

    for email_id in email_ids:
        status, msg_data = mail.fetch(email_id, "(RFC822)")

        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])

                # Get sender
                sender = email.utils.parseaddr(msg["From"])[1].lower()

                # Check if sender is allowed
                if not any(allowed in sender for allowed in allowed_senders):
                    print(f"Ignoring email from unauthorized sender: {sender}", file=sys.stderr)
                    continue

                # Get subject
                subject = decode_header(msg["Subject"])[0][0]
                if isinstance(subject, bytes):
                    subject = subject.decode()

                # Get body
                body = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            body = part.get_payload(decode=True).decode()
                            break
                else:
                    body = msg.get_payload(decode=True).decode()

                # Save task to file
                task_file = os.path.join(temp_dir, f"task_{task_count}.txt")
                with open(task_file, "w") as f:
                    f.write(f"FROM: {sender}\n")
                    f.write(f"SUBJECT: {subject}\n")
                    f.write(f"BODY:\n{body}\n")

                # Mark as read
                mail.store(email_id, '+FLAGS', '\Seen')
                task_count += 1

    mail.logout()
    print(f"Found {task_count} task(s)")

except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT

    # Process each task file
    # Track first task for session continuity
    local first_email_task=true

    for task_file in "$temp_dir"/task_*.txt; do
        [ -f "$task_file" ] || continue

        local sender=$(grep "^FROM:" "$task_file" | cut -d' ' -f2-)
        local subject=$(grep "^SUBJECT:" "$task_file" | cut -d' ' -f2-)
        local body=$(sed -n '/^BODY:/,$p' "$task_file" | tail -n +2)

        log "Processing task from $sender: $subject"

        # Check command type and process accordingly
        local result=""
        local reply_subject=""

        # Extract command from subject (lowercase for matching)
        local cmd=$(echo "$subject" | tr '[:upper:]' '[:lower:]')

        # 1. Check for control commands (stop-all, status, etc.)
        if result=$(process_control_command "$cmd" "$body"); then
            reply_subject="Re: $subject - Command Executed"

        # 2. Check for GitHub issue links
        elif result=$(process_github_issue "$subject" "$body"); then
            reply_subject="Re: $subject - Issue Processed"

        # 3. Check for dev commands
        elif [[ "$cmd" =~ ^dev ]]; then
            result=$(process_dev_command "$cmd" "$body" "$temp_dir")
            reply_subject="Re: $subject - Dev Mode"

        # 4. Regular task - execute via Claude
        else
            # Use --continue for subsequent tasks to maintain context
            if [[ "$first_email_task" == "true" ]]; then
                result=$(claude --dangerously-skip-permissions -p "You received a task via email. Execute it and provide a summary of what you did.

Subject: $subject

Task:
$body

Execute this task and provide a clear summary of the results." 2>&1)
                first_email_task=false
            else
                # Continue session - Claude already has context from previous tasks
                if ! result=$(claude --dangerously-skip-permissions --continue -p "Next email task:

Subject: $subject

Task:
$body

Execute this task and provide a summary." 2>&1); then
                    # Fallback to fresh session if --continue fails
                    result=$(claude --dangerously-skip-permissions -p "You received a task via email. Execute it and provide a summary of what you did.

Subject: $subject

Task:
$body

Execute this task and provide a clear summary of the results." 2>&1)
                fi
            fi
            reply_subject="Re: $subject - Completed"
        fi

        # Check if TODO.md was created/modified
        local todo_info=""
        if [[ -n "$DEV_PROJECT_DIR" ]] && [[ -f "$DEV_PROJECT_DIR/TODO.md" ]]; then
            todo_info="

---
📝 TODO.md Updated:

$(head -20 "$DEV_PROJECT_DIR/TODO.md")

(These items require manual action and cannot be automated.)
"
        fi

        # Send reply
        local reply_body="Task completed.

Results:
$result
$todo_info
--
Pauly AI Assistant"

        echo "$reply_body" | mail -s "$reply_subject" "$sender"
        log "Task completed, reply sent to $sender"
    done

    log "Email task check complete."
}

run_with_alerts "email-tasks" main
