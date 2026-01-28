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
TASK_SUBJECT_PREFIX="${TASK_SUBJECT_PREFIX:-[PAULY]}"

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
            echo "  [PAULY] dev init     - Body contains the project idea"
            echo "  [PAULY] dev task     - Body contains the task description"
            echo "  [PAULY] dev 10       - Run 10 iterations"
            echo "  [PAULY] dev          - Run default iterations"
            echo "  [PAULY] dev status   - Show development progress"
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

    # Fetch unread emails with task prefix using Python (more reliable than curl for IMAP)
    # Pass credentials via environment to avoid escaping issues
    IMAP_HOST="$IMAP_HOST" \
    IMAP_PORT="$IMAP_PORT" \
    IMAP_USER="$IMAP_USER" \
    IMAP_PASSWORD="$IMAP_PASSWORD" \
    ALLOWED_SENDERS="$ALLOWED_SENDERS" \
    TASK_SUBJECT_PREFIX="$TASK_SUBJECT_PREFIX" \
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
subject_prefix = os.environ.get("TASK_SUBJECT_PREFIX", "[PAULY]")
temp_dir = os.environ.get("TEMP_DIR", "/tmp")

try:
    # Connect to IMAP
    mail = imaplib.IMAP4_SSL(imap_host, imap_port)
    mail.login(username, password)
    mail.select("INBOX")

    # Search for unread emails with subject prefix
    status, messages = mail.search(None, 'UNSEEN', f'SUBJECT "{subject_prefix}"')

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
    for task_file in "$temp_dir"/task_*.txt; do
        [ -f "$task_file" ] || continue

        local sender=$(grep "^FROM:" "$task_file" | cut -d' ' -f2-)
        local subject=$(grep "^SUBJECT:" "$task_file" | cut -d' ' -f2-)
        local body=$(sed -n '/^BODY:/,$p' "$task_file" | tail -n +2)

        log "Processing task from $sender: $subject"

        # Check if this is a dev command
        local result=""
        local reply_subject=""

        # Extract command after prefix (e.g., "[PAULY] dev init" -> "dev init")
        local cmd=$(echo "$subject" | sed "s/^${TASK_SUBJECT_PREFIX}[[:space:]]*//" | tr '[:upper:]' '[:lower:]')

        if [[ "$cmd" =~ ^dev ]]; then
            # Handle dev commands
            result=$(process_dev_command "$cmd" "$body" "$temp_dir")
            reply_subject="Re: $subject - Dev Mode"
        else
            # Regular task - execute via Claude
            result=$(claude --print "You received a task via email. Execute it and provide a summary of what you did.

Subject: $subject

Task:
$body

Execute this task and provide a clear summary of the results." 2>&1)
            reply_subject="Re: $subject - Completed"
        fi

        # Send reply
        local reply_body="Task completed.

Results:
$result

--
Pauly AI Assistant"

        echo "$reply_body" | mail -s "$reply_subject" "$sender"
        log "Task completed, reply sent to $sender"
    done

    log "Email task check complete."
}

run_with_alerts "email-tasks" main
