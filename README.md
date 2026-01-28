# Pauly

A CLI tool for running automated AI-powered tasks. Includes daily summaries, git health checks, competitive project analysis, and autonomous development mode.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/tony-garand/pauly/main/install.sh | bash
```

This will clone to `~/.pauly`, add to PATH, and run the interactive setup.

## Commands

```
pauly run <job> [-bg]   Run a job (summary, git, research, all)
pauly dev [opts]        Autonomous development mode
pauly status            Show status of all scheduled jobs
pauly logs [job]        View logs
pauly tail [job]        Follow logs in real-time
pauly enable <job>      Enable a scheduled job (via cron)
pauly disable <job>     Disable a scheduled job
pauly test-email        Send a test email
pauly config            Configure settings interactively
pauly config show       Show current configuration
pauly setup             Run full setup wizard
```

## Autonomous Development Mode

Pauly includes an autonomous development system that runs a PLAN -> EXECUTE -> REVIEW -> FIX loop to build projects from idea files.

### Dev Commands

```bash
pauly dev [n]              # Run n iterations (default 25)
pauly dev init <idea.md>   # Bootstrap project from idea file
pauly dev refresh <notes>  # Add tasks from freeform notes
pauly dev task "desc"      # Run isolated single-task mode
pauly dev status           # Show development progress
```

### Dev Options

```
-n <num>            Max iterations (default 25)
--branch <name>     Use custom branch name (task mode)
--no-pr             Skip PR creation (task mode)
-f, --file <file>   Read task from file (task mode)
```

### How It Works

1. **Init**: Create `CONTEXT.md` (project info) and `TASKS.md` (checklist) from an idea file
2. **Plan**: Read the first unchecked task, search codebase, write plan to `.task`
3. **Execute**: Follow the plan, implement changes, mark task complete
4. **Review**: Verify outcome achieved, run tests, check code quality
5. **Fix**: If review fails, fix issues in priority order

### Examples

```bash
# Start a new project from an idea
echo "Build a CLI tool that converts markdown to HTML" > idea.md
pauly dev init idea.md
pauly dev 10

# Add more features from notes
echo "Add syntax highlighting and dark mode" > notes.md
pauly dev refresh notes.md
pauly dev

# Work on a single isolated task
pauly dev task "Add unit tests for the parser"

# Task with custom branch and no PR
pauly dev task --branch fix-parser --no-pr "Fix edge case in parser"
```

### Session Limit Handling

Pauly automatically detects API rate limits and session limits, waiting and retrying as needed. No manual intervention required for long-running development sessions.

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `summary` | 5:00am daily | Summarizes Claude Code activity from the last 24 hours |
| `git` | 6:00am daily | Checks all repos for uncommitted changes, unpushed commits, stale branches |
| `research` | 7:00am Mondays | Analyzes projects and finds similar tools/improvements |
| `tasks` | Every 5 min | Checks inbox for email tasks and executes them |

Enable/disable jobs:
```bash
pauly enable all        # Enable all jobs
pauly disable research  # Disable specific job
pauly status            # Check what's enabled
```

## Running Jobs Manually

```bash
# Run in foreground
pauly run summary

# Run in background (persists after SSH disconnect)
pauly run all -bg

# Monitor background job
pauly tail
```

## Configuration

Run the interactive configuration wizard:

```bash
pauly config
```

This will prompt you for:
- **Email** - Where to send notifications and alerts
- **Projects directory** - Where your git repos live
- **SMTP settings** - Host, port, username, and app password
- **Advanced settings** - Log rotation, healthcheck URL

### Gmail Setup

1. Go to https://myaccount.google.com/apppasswords
2. Generate an app password for "Mail"
3. Run `pauly config` and enter the app password when prompted

Configuration files:
- `~/.config/pauly/config` - Pauly settings
- `~/.msmtprc` - SMTP settings (auto-generated)

## Project Structure

```
~/.pauly/
├── pauly                           # CLI tool
├── install.sh                      # Installer (curl-able)
├── setup.sh                        # Setup wizard
├── daily-claude-summary.sh         # Daily activity summary
├── git-health-check.sh             # Git repo health check
├── project-research.sh             # Competitive analysis
├── check-email-tasks.sh            # Email task processor
├── lib/
│   ├── common.sh                   # Shared functions
│   ├── config.sh                   # Configuration management
│   └── dev.sh                      # Autonomous development system
├── logs/                           # Log files (auto-rotated)
└── cache/
    └── research/                   # Cached research results

# Per-project dev files (created by pauly dev)
your-project/
├── CONTEXT.md                      # Project info, tech stack, commands
├── TASKS.md                        # Task checklist
├── .task                           # Current task state (temporary)
└── .pauly/
    ├── logs/                       # Dev session logs
    └── tasks/                      # Isolated task states
```

## Email Tasks

Send tasks to Pauly via email and get results back automatically.

### Setup

1. Run `pauly config` and enable email tasks when prompted
2. Enable the tasks job: `pauly enable tasks`

### Usage

Send an email to your configured address with:
- **Subject** starting with `[PAULY]` (configurable)
- **Body** containing the task you want executed

Example:
```
To: your-email@gmail.com
Subject: [PAULY] Update dependencies

Check all my projects for outdated npm dependencies
and create a summary of what needs updating.
```

Pauly will:
1. Check your inbox every 5 minutes
2. Execute the task via Claude
3. Reply with the results

### Security

- Only emails from allowed senders are processed (configured during setup)
- Tasks are executed in the context of your projects directory

## Features

- **Autonomous development** - PLAN->EXECUTE->REVIEW->FIX loop builds projects from ideas
- **Email-driven tasks** - Send tasks via email, get results back
- **Cron-based scheduling** - Works on any Unix system
- **Interactive configuration** - No manual file editing
- **Automatic log rotation** - Logs rotate at 10MB, keeps 5 files
- **Failure alerts** - Email notification if any job fails
- **Background execution** - Run jobs that persist after SSH disconnect
- **Research caching** - Project analysis cached for 7 days
- **Session limit handling** - Automatic retry on API rate limits
- **Isolated task mode** - Work on single tasks with automatic branching and PRs

## Troubleshooting

**Check job status:**
```bash
pauly status
crontab -l  # View raw cron entries
```

**View logs:**
```bash
pauly logs summary
pauly tail git
```

**Test email:**
```bash
pauly test-email
```

**Re-enable a job:**
```bash
pauly disable summary
pauly enable summary
```

## Requirements

- macOS or Linux
- Python 3 (for email tasks)
- Claude CLI (`claude`)
- Gmail account (for notifications)
- GitHub CLI (`gh`) (optional, for PR creation)
