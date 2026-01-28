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
    python3 << PYTHON_SCRIPT
import imaplib
import email
from email.header import decode_header
import os
import sys

imap_host = "$IMAP_HOST"
imap_port = $IMAP_PORT
username = "$IMAP_USER"
password = "$IMAP_PASSWORD"
allowed_senders = "$ALLOWED_SENDERS".lower().split(",")
subject_prefix = "$TASK_SUBJECT_PREFIX"
temp_dir = "$temp_dir"

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

        # Execute task via Claude
        local result=$(claude --print "You received a task via email. Execute it and provide a summary of what you did.

Subject: $subject

Task:
$body

Execute this task and provide a clear summary of the results." 2>&1)

        # Send reply
        local reply_subject="Re: $subject - Completed"
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
