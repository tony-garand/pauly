# Pauly

A CLI tool for running automated AI-powered tasks on a dedicated Mac Mini (or any Mac). Includes daily summaries, git health checks, and competitive project analysis.

## Quick Start

```bash
# Add CLI to PATH
sudo ln -sf ~/Projects/pauly/pauly /usr/local/bin/pauly

# Configure Pauly (interactive prompts)
pauly config

# Run Mac Mini setup (for dedicated server)
pauly setup

# Test it
pauly test-email
pauly run summary
```

## Commands

```
pauly run <job> [-bg]   Run a job (summary, git, research, all)
pauly status            Show status of all scheduled jobs
pauly logs [job]        View logs
pauly tail [job]        Follow logs in real-time
pauly enable <job>      Enable a scheduled job
pauly disable <job>     Disable a scheduled job
pauly test-email        Send a test email
pauly setup             Run Mac Mini setup
pauly config            Configure settings interactively
pauly config show       Show current configuration
```

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `summary` | 5:00am daily | Summarizes Claude Code activity from the last 24 hours |
| `git` | 6:00am daily | Checks all repos for uncommitted changes, unpushed commits, stale branches |
| `research` | 7:00am Mondays | Analyzes projects and finds similar tools/improvements |

## Running Jobs Manually

```bash
# Run in foreground (stops if you disconnect SSH)
pauly run summary

# Run in background (persists after SSH disconnect)
pauly run all -bg

# Monitor background job
pauly tail
```

## Project Structure

```
pauly/
├── pauly                           # CLI tool
├── daily-claude-summary.sh         # Daily activity summary
├── git-health-check.sh             # Git repo health check
├── project-research.sh             # Competitive analysis
├── setup-mac-mini.sh               # Full Mac setup script
├── lib/
│   ├── common.sh                   # Shared functions
│   └── config.sh                   # Configuration management
├── logs/                           # Log files (auto-rotated)
├── cache/
│   └── research/                   # Cached research results
└── com.user.*.plist                # launchd job configs

~/.config/pauly/config              # User configuration (created by 'pauly config')
```

## Features

- **Automatic log rotation** - Logs rotate at 10MB, keeps 5 files
- **Failure alerts** - Email notification if any job fails
- **Background execution** - Run jobs that persist after SSH disconnect
- **Research caching** - Project analysis cached for 7 days

## Mac Mini Setup

The setup script configures:

- Homebrew and required packages
- Power management (no sleep, auto-restart after power failure)
- SSH remote access
- Email via msmtp
- Tailscale for secure remote access
- All scheduled jobs via launchd

### Email Configuration

Edit `~/.msmtprc` with your Gmail credentials:

```
defaults
auth           on
tls            on
tls_trust_file /etc/ssl/cert.pem
logfile        ~/.msmtp.log

account        gmail
host           smtp.gmail.com
port           587
from           your-email@gmail.com
user           your-email@gmail.com
password       your-app-password

account default : gmail
```

Generate an app password at: https://myaccount.google.com/apppasswords

## Configuration

Run the interactive configuration wizard:

```bash
pauly config
```

This will prompt you for:
- **Email** - Where to send notifications and alerts
- **Projects directory** - Where your git repos live
- **Advanced settings** - Log rotation, healthcheck URL

Configuration is stored in `~/.config/pauly/config`.

To view current settings:
```bash
pauly config show
```

## Troubleshooting

**Check job status:**
```bash
pauly status
launchctl list | grep com.user
```

**View logs:**
```bash
pauly logs summary
pauly tail git
```

**Test email:**
```bash
echo "test" | mail -s "Test" your-email@gmail.com
```

**Reload a job after editing plist:**
```bash
pauly disable summary
pauly enable summary
```

## Requirements

- macOS
- Homebrew
- Claude CLI (`claude`)
- Gmail account (for notifications)
