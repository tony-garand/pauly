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

### TASKS.md vs TODO.md

Projects use two different files for tracking work:

**TASKS.md** - Development tasks that CAN be automated by AI:
- Code changes, feature implementation, bug fixes
- Writing tests, updating configs, refactoring
- Database migrations, API integrations
- Documentation updates within the codebase

**TODO.md** - Non-development tasks requiring human action:
- Sign up for external services / get credentials
- Get API keys or access tokens
- Manual testing or stakeholder reviews
- Physical world actions (meetings, purchases)
- External dependencies (waiting for others)
- Decisions requiring human input

When processing tasks, Pauly will:
1. Automatically move non-actionable items from TASKS.md to TODO.md
2. Notify via GitHub issue comment, email, or admin UI toast when TODO.md is updated
3. Focus development time only on tasks that can be completed via code

The admin dashboard provides CRUD operations for TODO.md files in each project.

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
│   ├── autofix.sh            # Auto-fix module
│   └── railway.sh            # Railway helper functions
├── Skills/                   # Claude skill files
│   ├── CLAUDE.md             # Skills documentation
│   ├── railway-deploy.md     # Deploy to Railway skill
│   ├── railway-link.md       # Link project skill
│   ├── railway-logs.md       # View logs skill
│   ├── railway-env.md        # Manage env vars skill
│   └── railway-status.md     # Check status skill
├── admin/                    # Web admin dashboard
│   ├── client/               # React frontend (Vite + shadcn/ui)
│   └── server/               # Express backend
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
- Label: `project:name` or `product:name` (optional - targets specific project in ~/Projects)
- Title: Task description or dev command
- Body: Details/context

#### Project/Product Label Behavior

**IMPORTANT:** Without an explicit `project:` or `product:` label:
- Pauly will NOT create new directories in ~/Projects
- Tasks about Pauly itself (title contains "pauly" or body references `~/.pauly`) will work in `~/.pauly`
- Tasks may work in existing projects if one can be inferred from the title
- Otherwise, the task will fail with an error asking for a label

This prevents accidental project creation and ensures task isolation.

#### Issue Isolation
Each GitHub issue is processed in isolation:
- Sessions are cleared between different issues
- Context from one issue cannot contaminate another
- Each issue gets its own working directory based on its labels

#### One Task Per Project
Only one task can run per project at a time:
- If issue #1 is working on `project:fartly`, issue #2 targeting the same project will wait
- The waiting issue gets a comment explaining it's queued
- Locks auto-expire after 1 hour (for crashed processes)
- This prevents conflicting changes to the same codebase

### Email (Optional)
Send any email from an allowed sender (no subject prefix required)

## Common Commands

```bash
pauly status              # Show job status and configuration
pauly run tasks           # Manually check for tasks
pauly logs tasks          # View task processing logs
pauly tail tasks          # Follow task logs live
pauly config              # Interactive configuration
pauly config show         # Show current config
```

## Admin Dashboard

Pauly includes a web-based admin dashboard for monitoring and management:

```bash
pauly admin start         # Start the dashboard server
pauly admin stop          # Stop the dashboard server
pauly admin status        # Check if dashboard is running
pauly admin restart       # Restart the dashboard
pauly admin logs          # View server logs
```

### Dashboard Features
- **Status**: View scheduled job states and Pauly configuration
- **Projects**: Browse projects with git status, task progress, dev cycle status, and Railway deployment
- **Railway**: View Railway auth status and list cloud projects
- **CLIs**: Check installed/missing CLI tools
- **Logs**: View and tail log files with auto-refresh

### Dev Cycle Monitoring

The Projects page shows real-time dev cycle status for each project:

- **Dev Running** (blue, pulsing): A `pauly dev` cycle is currently running
- **Running (errors)** (yellow): Dev cycle running but has encountered errors
- **Complete** (green): Dev cycle finished successfully
- **Error** (red): Dev cycle stopped with errors

The summary card shows the count of projects with active dev cycles. The page polls every 10 seconds for updates.

Individual project pages show detailed dev logs with:
- Phase identification (plan, execute, review, fix)
- Error parsing with file/line information
- Suggested fixes for common errors
- Full log viewer

### Configuration
Add to `~/.config/pauly/config`:
- `ADMIN_PORT` - Server port (default: 3001)
- `ADMIN_ALLOWED_IP` - Comma-separated IPs allowed to access (localhost always allowed)

Example:
```bash
ADMIN_PORT=3001
ADMIN_ALLOWED_IP=192.168.1.100,192.168.1.101
```

### Access
Once started, access the dashboard at `http://localhost:3001` (or your configured port).

## Railway Integration

Pauly integrates with [Railway](https://railway.app) for deploying projects to the cloud.

### Railway CLI Commands

```bash
pauly railway deploy       # Deploy current directory to Railway
pauly railway link         # Link to existing Railway project (interactive)
pauly railway status       # Check deployment status
pauly railway logs         # View deployment logs
pauly railway env          # List environment variables
pauly railway env set K=V  # Set environment variable
pauly railway env unset K  # Remove environment variable
pauly railway init         # Initialize new Railway project
pauly railway open         # Open project in browser
pauly railway login        # Authenticate with Railway
pauly railway whoami       # Show current Railway user
```

### Railway Skills

Railway deployment skills are available in `~/.pauly/Skills/`:
- `railway-deploy.md` - Deploy project to Railway
- `railway-link.md` - Link local project to Railway project
- `railway-logs.md` - View Railway deployment logs
- `railway-env.md` - Manage environment variables
- `railway-status.md` - Check deployment status

### Admin Dashboard Railway Features

The admin dashboard provides Railway integration through two pages:

#### Railway Overview Page (`/railway`)
- View Railway authentication status (logged in user)
- List all Railway projects in your account
- Quick links to Railway dashboard and documentation
- **Note**: Deploy/logs must be done from individual project pages

#### Project Detail Page (`/projects/<name>`)
Each project page has a Railway section with:
- **Link Project**: Connect local project to a Railway project
  - Select Railway project from dropdown
  - Select service (required for projects with multiple services)
- **Deploy**: Deploy the linked project to Railway
- **Dashboard**: Quick link to Railway overview page

### How Railway Linking Works

Railway CLI commands are **directory-based** - they need to run from a folder that's been linked to a Railway project. The admin dashboard handles this by:

1. Storing the local project path when you click Deploy/Link
2. Running Railway CLI commands from that directory
3. Using the `--project` and `--service` flags for non-interactive linking

### Getting Started with Railway

#### Via Terminal (Interactive)
```bash
# 1. Authenticate
railway login

# 2. Navigate to your project
cd ~/Projects/my-project

# 3. Link (interactive - lets you choose project/environment/service)
railway link

# 4. Deploy
railway up
```

#### Via Admin Dashboard
1. Authenticate first (terminal): `railway login`
2. Open dashboard: http://localhost:3001
3. Go to Projects → Select your project
4. Click **Link Project**:
   - Choose a Railway project from the dropdown
   - Choose a service (if project has multiple services)
   - Click **Link**
5. Click **Deploy** to deploy

### Railway API Endpoints

The admin server exposes these Railway endpoints:

```
GET  /api/railway/status              # Get auth status
GET  /api/railway/projects            # List Railway projects (includes services)
POST /api/railway/link                # Link local project to Railway
     Body: { projectPath, railwayProjectId, serviceId? }
POST /api/railway/projects/_/deploy   # Deploy project
     Body: { projectPath, detach? }
GET  /api/railway/projects/_/logs     # Get deployment logs
     Query: projectPath, lines?
```

### Troubleshooting

#### "No linked project found"
The local directory isn't linked to a Railway project. Either:
- Run `railway link` in the project directory (terminal)
- Use the Link Project button in the admin dashboard

#### "Multiple services found"
Your Railway project has multiple services. You must select which service to deploy to:
- Terminal: `railway link` and select the service interactively
- Dashboard: Select the service when linking

#### "Railway project ID is required"
The admin dashboard requires selecting a Railway project to link. The `railway link` command is interactive in terminal but requires explicit project/service IDs when run programmatically.

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
- Railway CLI (`railway`) for cloud deployments
- msmtp for email notifications
- cron for scheduling

## CI/CD Pipeline

Pauly uses GitHub Actions for continuous integration and automated version management.

### Workflows

**CI (`.github/workflows/ci.yml`)**
- Runs on all pushes to `main` and pull requests
- Type checks both server and client code
- Lints the client codebase
- Builds and verifies artifacts

**Version Bump (`.github/workflows/version-bump.yml`)**
- Automatically bumps patch version on push to `main`
- Skips documentation-only changes
- Updates version in root, server, and client package.json files
- Commits with `[skip ci]` to prevent infinite loops

### CI/CD Best Practices

When working with Pauly's CI/CD:

#### 1. Pull Before Push (Recommended)
Always pull to incorporate CI's version bump commits before pushing:
```bash
git pull --rebase origin main
git push
```

#### 2. Use `[skip ci]` for Version-Sensitive Commits
To make changes without triggering a version bump:
```bash
git commit -m "your message [skip ci]"
git push
```
Use sparingly - only for documentation-only changes or CI fixes.

#### 3. Avoid Force Push to Main
Force pushing can overwrite CI automation commits:
- Use `git push` without `--force`
- If you must force push, wait for CI to complete, then pull to sync

#### 4. After Force Push Recovery
If you've overwritten a version bump:
```bash
# CI will run again on your push
# Wait for it to complete, then pull to sync
git pull origin main
```

#### 5. Check CI Status
After pushing, monitor the Actions tab to ensure:
- CI passes (lint, typecheck, build)
- Version bump completes (if applicable)

### Version Management

The project uses semantic versioning:
- Root `package.json` holds the canonical version
- Admin server and client versions sync automatically
- Version bumps are patch-level (1.0.0 → 1.0.1)
