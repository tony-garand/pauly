# Pauly Admin Dashboard

Web-based admin dashboard for monitoring and managing Pauly.

## Features

- **Claude Terminal**: Send prompts to Claude from the dashboard with real-time streaming responses
- **Status**: View scheduled job states and Pauly configuration
- **Projects**: Browse projects with git status and task progress
- **CLIs**: Check installed/missing CLI tools
- **Logs**: View and tail log files with auto-refresh

## Quick Start

```bash
# From Pauly CLI
pauly admin start

# Or run directly
cd ~/.pauly/admin
pnpm install
pnpm dev
```

## Architecture

```
admin/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/   # UI components (shadcn/ui)
│   │   ├── pages/        # Route pages
│   │   ├── lib/          # API utilities
│   │   └── hooks/        # React hooks
│   └── ...
└── server/          # Express backend
    ├── src/
    │   ├── routes/       # API route handlers
    │   ├── middleware/   # IP filtering, etc.
    │   └── lib/          # Utilities
    └── ...
```

## Tech Stack

**Frontend:**
- Vite + React + TypeScript
- Tailwind CSS v4
- shadcn/ui components
- React Router v7

**Backend:**
- Express + TypeScript
- IP filtering middleware

## Configuration

Add to `~/.config/pauly/config`:

```bash
ADMIN_PORT=3001
ADMIN_ALLOWED_IP=192.168.1.100,192.168.1.101
```

- `ADMIN_PORT` - Server port (default: 3001)
- `ADMIN_ALLOWED_IP` - Comma-separated IPs allowed to access (localhost always allowed)

## Development

```bash
# Run both client and server in dev mode
pnpm dev

# Run only client
pnpm dev:client

# Run only server
pnpm dev:server

# Build for production
pnpm build

# Type checking
pnpm typecheck
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/clis` | List CLI tools with install status |
| `GET /api/projects` | List all projects |
| `GET /api/projects/:name` | Project details with task list |
| `GET /api/pauly/status` | Scheduled job status |
| `GET /api/pauly/config` | Pauly configuration |
| `GET /api/pauly/logs` | Available log files |
| `GET /api/pauly/logs/:job` | Log file contents |
| `POST /api/pauly/claude` | Stream Claude prompt response (SSE) |
