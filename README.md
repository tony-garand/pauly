# Pauly

A CLI tool for running automated AI-powered tasks. Includes daily summaries, git health checks, and competitive project analysis.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/tony-garand/pauly/main/install.sh | bash
```

This will clone to `~/.pauly`, add to PATH, and run the interactive setup.

## Commands

```
pauly run <job> [-bg]   Run a job (summary, git, research, all)
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

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `summary` | 5:00am daily | Summarizes Claude Code activity from the last 24 hours |
| `git` | 6:00am daily | Checks all repos for uncommitted changes, unpushed commits, stale branches |
| `research` | 7:00am Mondays | Analyzes projects and finds similar tools/improvements |

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
├── lib/
│   ├── common.sh                   # Shared functions
│   └── config.sh                   # Configuration management
├── logs/                           # Log files (auto-rotated)
└── cache/
    └── research/                   # Cached research results
```

## Features

- **Cron-based scheduling** - Works on any Unix system
- **Interactive configuration** - No manual file editing
- **Automatic log rotation** - Logs rotate at 10MB, keeps 5 files
- **Failure alerts** - Email notification if any job fails
- **Background execution** - Run jobs that persist after SSH disconnect
- **Research caching** - Project analysis cached for 7 days

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
- Homebrew (macOS) or apt (Linux)
- Claude CLI (`claude`)
- Gmail account (for notifications)
