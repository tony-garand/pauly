# Pauly - Autonomous AI Assistant CLI

This is **Pauly**, an autonomous AI-powered task automation system owned by Tony Garand.

## What Pauly Does

Pauly runs automated AI-powered tasks via cron jobs and GitHub Issues:

### Scheduled Jobs
- **summary** (5am daily): Summarizes Claude Code activity from last 24 hours
- **git** (6am daily): Checks all repos for uncommitted changes, unpushed commits, stale branches
- **research** (7am Mondays): Analyzes projects and finds similar tools/improvements
- **tasks** (every 5 min): Checks GitHub Issues for tasks with `pauly` label

### Autonomous Development Mode
Pauly can build entire projects from idea files using a PLAN -> EXECUTE -> REVIEW -> FIX loop:
- `pauly dev init <idea.md>` - Bootstrap project from idea
- `pauly dev [n]` - Run n iterations of the dev loop
- `pauly dev task "desc"` - Run isolated single-task mode

## Directory Structure

```
~/.pauly/
├── pauly                     # Main CLI (bash)
├── check-github-tasks.sh     # GitHub Issues task processor
├── check-email-tasks.sh      # Email task processor
├── daily-claude-summary.sh   # Daily activity summary
├── git-health-check.sh       # Git repo health check
├── project-research.sh       # Competitive analysis
├── lib/
│   ├── common.sh             # Shared functions
│   ├── config.sh             # Configuration management
│   ├── dev.sh                # Autonomous development system
│   └── autofix.sh            # Auto-fix module
├── logs/                     # Log files
│   ├── github-tasks.log      # GitHub task processing logs
│   ├── cron.log              # Cron job logs
│   └── autofix/              # Auto-fix attempt logs
└── cache/
    └── research/             # Cached research results
```

## Configuration

Config lives at `~/.config/pauly/config`:
- `EMAIL` - Notification email address
- `PROJECTS_DIR` - Where projects live (default: ~/Projects)
- `GITHUB_TASKS_REPO` - GitHub repo for task issues (e.g., tony-garand/pauly-tasks)
- `GITHUB_TASKS_LABEL` - Label to filter issues (default: pauly)

## Task Input Methods

### GitHub Issues (Primary)
Create issues in the configured repo with:
- Label: `pauly` (required)
- Label: `project:name` (optional - targets specific project in ~/Projects)
- Title: Task description or dev command
- Body: Details/context

### Email (Optional)
Send email with subject starting with `[PAULY]`

## Common Commands

```bash
pauly status              # Show job status and configuration
pauly run tasks           # Manually check for tasks
pauly logs tasks          # View task processing logs
pauly tail tasks          # Follow task logs live
pauly config              # Interactive configuration
pauly config show         # Show current config
```

## Session Management

Tasks use project-scoped session continuity for efficiency:
- **Same project**: Uses `--continue` flag to maintain context between tasks
- **Different project**: Starts fresh session to prevent cross-project contamination
- Session state tracked in `logs/.current-project-session`

This allows efficient multi-tasking within a project while ensuring isolation between projects.

## Tech Stack
- Bash scripts
- Claude CLI (`claude`) for AI tasks
- GitHub CLI (`gh`) for issue management
- msmtp for email notifications
- cron for scheduling
