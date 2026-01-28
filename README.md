# AI Assistant

A CLI tool for running automated AI-powered tasks on a dedicated Mac Mini (or any Mac). Includes daily summaries, git health checks, and competitive project analysis.

## Quick Start

```bash
# Run setup (configures everything)
sudo ./setup-mac-mini.sh

# Add CLI to PATH
sudo ln -sf ~/Projects/ai-assistant/ai-assistant /usr/local/bin/ai-assistant

# Configure email (required for notifications)
nano ~/.msmtprc  # Add your Gmail app password

# Test it
ai-assistant test-email
ai-assistant run summary
```

## Commands

```
ai-assistant run <job> [-bg]   Run a job (summary, git, research, all)
ai-assistant status            Show status of all scheduled jobs
ai-assistant logs [job]        View logs
ai-assistant tail [job]        Follow logs in real-time
ai-assistant enable <job>      Enable a scheduled job
ai-assistant disable <job>     Disable a scheduled job
ai-assistant test-email        Send a test email
ai-assistant setup             Run Mac Mini setup
ai-assistant config            Edit configuration
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
ai-assistant run summary

# Run in background (persists after SSH disconnect)
ai-assistant run all -bg

# Monitor background job
ai-assistant tail
```

## Project Structure

```
ai-assistant/
├── ai-assistant                    # CLI tool
├── daily-claude-summary.sh         # Daily activity summary
├── git-health-check.sh             # Git repo health check
├── project-research.sh             # Competitive analysis
├── setup-mac-mini.sh               # Full Mac setup script
├── lib/
│   └── common.sh                   # Shared functions
├── logs/                           # Log files (auto-rotated)
├── cache/
│   └── research/                   # Cached research results
└── com.user.*.plist                # launchd job configs
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

Edit settings in `lib/common.sh`:

```bash
EMAIL="your-email@gmail.com"      # Notification email
MAX_LOG_SIZE_MB=10                # Log rotation threshold
MAX_LOG_FILES=5                   # Number of rotated logs to keep
```

## Troubleshooting

**Check job status:**
```bash
ai-assistant status
launchctl list | grep com.user
```

**View logs:**
```bash
ai-assistant logs summary
ai-assistant tail git
```

**Test email:**
```bash
echo "test" | mail -s "Test" your-email@gmail.com
```

**Reload a job after editing plist:**
```bash
ai-assistant disable summary
ai-assistant enable summary
```

## Requirements

- macOS
- Homebrew
- Claude CLI (`claude`)
- Gmail account (for notifications)
