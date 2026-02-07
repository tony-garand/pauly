# Pauly Admin Dashboard

Web-based admin dashboard for monitoring and managing Pauly — your autonomous AI task automation system.

## Features

- **Claude Terminal** — Send prompts to Claude directly from the dashboard with real-time streaming responses
- **Project Management** — Browse projects, manage tasks (drag-drop reorder), edit CONTEXT.md and TODO.md, import repos from GitHub
- **Dev Cycle Monitoring** — Start/stop/restart autonomous dev processes, view real-time logs with phase detection and error parsing
- **Railway Integration** — Link projects to Railway, deploy, view logs, manage services
- **Task Queue** — View and manage the SQLite-backed job queue, enqueue/dequeue/retry jobs
- **Dead Letter Queue** — Inspect failed tasks, retry or resolve them, cleanup old entries
- **Metrics & Observability** — Task success/failure rates, time-series charts, per-project breakdowns
- **Log Viewer** — Browse and tail log files with auto-refresh
- **CLI Management** — Check installed/missing CLI tools, install missing ones via Claude
- **Configuration** — Edit Pauly settings (config file values) from the UI
- **Killswitch** — Stop all running Claude processes with one click
- **Git Pull** — Update Pauly from the remote repo

## Quick Start

```bash
# From Pauly CLI
pauly admin start

# Open in browser
open http://localhost:3001

# Stop
pauly admin stop
```

### Development Mode

```bash
cd ~/.pauly/admin

# Server (hot reload with tsx watch)
cd server && pnpm dev

# Client (Vite dev server with HMR)
cd client && pnpm dev
```

### Production Build

```bash
cd ~/.pauly/admin/server && pnpm build
cd ~/.pauly/admin/client && pnpm build
pauly admin restart
```

## Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | System health, Claude terminal, stats overview, jobs list, recent projects |
| Projects | `/projects` | All projects with git status, task progress, dev status, Railway deploy |
| Project Detail | `/projects/:name` | Full project view — CONTEXT.md editor, TASKS.md with drag-drop, TODO.md, dev logs, issue creation, Railway link/deploy |
| Railway | `/railway` | Railway auth status, list all Railway projects and services |
| Status | `/status` | Scheduled job status and configuration overview |
| Logs | `/logs` | Browse available log files, view contents |
| Log Detail | `/logs/:job` | Tail a specific log file with auto-refresh |
| Config | `/config` | View and edit Pauly configuration values |
| CLIs | `/clis` | Installed/missing CLI tools, install via Claude |
| Metrics | `/metrics` | Task execution metrics, success rates, timelines |
| Dead Letter | `/deadletter` | Failed tasks — retry, resolve, or cleanup |

## Architecture

```
admin/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── components/     # UI components (shadcn/ui) + ClaudeTerminal
│       ├── pages/          # 10 route pages
│       ├── lib/            # API client (api.ts) + utilities
│       └── hooks/          # React hooks
└── server/                 # Express backend
    └── src/
        ├── routes/         # 9 route modules
        │   ├── pauly.ts    # Status, config, logs, kill, git-pull, claude streaming
        │   ├── projects.ts # CRUD, tasks, dev process, context/todo, issues
        │   ├── clis.ts     # CLI detection + installation via Claude
        │   ├── railway.ts  # Railway projects, deploy, logs, link
        │   ├── queue.ts    # Job queue management
        │   ├── deadletter.ts # Failed task management
        │   ├── metrics.ts  # Task execution metrics
        │   ├── dashboard.ts # Batched dashboard data endpoint
        │   └── docs.ts     # Swagger/OpenAPI documentation
        ├── middleware/      # IP filtering
        └── lib/            # SQLite database, config, projects, caching, logging
```

## Tech Stack

**Frontend:**
- React 19 + Vite + TypeScript
- Tailwind CSS v4 + shadcn/ui
- React Router v7
- @dnd-kit (drag-drop task reordering)
- sonner (toast notifications)
- lucide-react (icons)

**Backend:**
- Express 4 + TypeScript
- better-sqlite3 (task queue, metrics, dead letter queue)
- swagger-jsdoc + swagger-ui-express (API docs at `/api/docs`)
- IP filtering middleware
- SSE streaming (Claude terminal)

## API Endpoints

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health, database status, DLQ stats, metrics summary |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Batched data for dashboard (projects, metrics, queue, DLQ) |

### Pauly
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pauly/status` | Scheduled job status |
| GET | `/api/pauly/config` | Configuration values (sanitized) |
| PATCH | `/api/pauly/config` | Update a config value |
| DELETE | `/api/pauly/config/:key` | Delete a config value |
| GET | `/api/pauly/logs` | List available log files |
| GET | `/api/pauly/logs/:job` | Log file contents (supports `?tail=N`) |
| POST | `/api/pauly/kill` | Kill all Claude processes |
| POST | `/api/pauly/git-pull` | Pull latest Pauly from remote |
| POST | `/api/pauly/tasks` | Create GitHub Issue with pauly label |
| POST | `/api/pauly/claude` | Stream Claude prompt response (SSE) |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:name` | Project details (git, tasks, context) |
| DELETE | `/api/projects/:name` | Delete a project |
| POST | `/api/projects/import` | Clone a GitHub repo |
| POST | `/api/projects/:name/tasks` | Add a task |
| PATCH | `/api/projects/:name/tasks/:index` | Toggle task completion |
| DELETE | `/api/projects/:name/tasks/:index` | Delete a task |
| POST | `/api/projects/:name/tasks/reorder` | Reorder tasks (drag-drop) |
| POST | `/api/projects/:name/tasks/archive` | Archive completed tasks |
| POST | `/api/projects/:name/issues` | Create issue → generate tasks via Claude |
| GET | `/api/projects/:name/issues/:jobId` | Check issue job status |
| GET | `/api/projects/:name/dev` | Dev process status |
| POST | `/api/projects/:name/dev/start` | Start dev process |
| POST | `/api/projects/:name/dev/stop` | Stop dev process |
| POST | `/api/projects/:name/dev/restart` | Restart dev process |
| DELETE | `/api/projects/:name/dev/log` | Clear dev log |
| GET | `/api/projects/:name/context` | Get CONTEXT.md |
| PUT | `/api/projects/:name/context` | Update CONTEXT.md |
| DELETE | `/api/projects/:name/context` | Delete CONTEXT.md |
| GET | `/api/projects/:name/todo` | Get TODO.md |
| PUT | `/api/projects/:name/todo` | Update TODO.md |
| DELETE | `/api/projects/:name/todo` | Delete TODO.md |

### CLIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clis` | List all CLIs with install status |
| POST | `/api/clis` | Add a custom CLI to track |
| DELETE | `/api/clis/:name` | Remove a custom CLI |
| POST | `/api/clis/:name/install` | Install CLI via Claude |
| GET | `/api/clis/:name/install` | Check installation progress |

### Railway
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/railway/status` | Auth status |
| GET | `/api/railway/projects` | List Railway projects (with services) |
| GET | `/api/railway/projects/:id` | Project details |
| POST | `/api/railway/projects/_/deploy` | Deploy to Railway |
| GET | `/api/railway/projects/_/logs` | View deployment logs |
| POST | `/api/railway/link` | Link local project to Railway |
| GET | `/api/railway/deployments` | List recent deployments |

### Queue
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/queue/stats` | Queue statistics |
| GET | `/api/queue/jobs` | List jobs (filter by status/type) |
| GET | `/api/queue/jobs/:id` | Get specific job |
| POST | `/api/queue/enqueue` | Add job to queue |
| POST | `/api/queue/dequeue` | Get next job (atomic) |
| POST | `/api/queue/jobs/:id/ack` | Acknowledge job success |
| POST | `/api/queue/jobs/:id/nack` | Report job failure |
| DELETE | `/api/queue/jobs/:id` | Cancel a job |
| PATCH | `/api/queue/jobs/:id/priority` | Update job priority |
| POST | `/api/queue/cleanup` | Cleanup stale/old jobs |

### Metrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics/summary` | Summary for N days |
| GET | `/api/metrics/timeline` | Time-series data (hour/day granularity) |
| GET | `/api/metrics/projects/:name` | Project-specific metrics |
| POST | `/api/metrics/cleanup` | Cleanup old metrics |

### Dead Letter Queue
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deadletter` | List failed tasks (filter by status) |
| GET | `/api/deadletter/stats` | DLQ statistics |
| GET | `/api/deadletter/retryable` | Tasks ready for retry |
| GET | `/api/deadletter/:id` | Get specific failed task |
| POST | `/api/deadletter/:id/retry` | Retry a failed task |
| POST | `/api/deadletter/:id/resolve` | Mark as resolved |
| DELETE | `/api/deadletter/:id` | Delete a failed task |
| POST | `/api/deadletter/cleanup` | Cleanup old resolved tasks |

### Docs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docs` | Swagger UI for API documentation |

## Configuration

Add to `~/.config/pauly/config`:

```bash
ADMIN_PORT=3001                                    # Server port (default: 3001)
ADMIN_ALLOWED_IP=192.168.1.100,192.168.1.101       # Restrict access by IP (localhost always allowed)
```

## Database

The admin server uses SQLite (`~/.pauly/data/pauly.db`) with WAL mode for concurrent access. Tables:

| Table | Purpose |
|-------|---------|
| `jobs` | Task queue with priority, status, retry tracking |
| `failed_tasks` | Dead letter queue for tasks that exceeded retries |
| `task_metrics` | Execution metrics (duration, success/failure, errors) |
| `users` | Multi-user authentication (username/password, roles) |
| `sessions` | Auth session management |
| `project_access` | Per-project access control (read/write/admin) |
| `audit_log` | Action tracking with user, resource, and IP |
