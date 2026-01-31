# Issue #28: TODO.md Management Feature

## Overview
This feature adds full CRUD (Create, Read, Update, Delete) support for TODO.md files in the Pauly admin dashboard, along with a notification system to alert users when TODO.md is modified through different channels.

## Key Concepts

### TODO.md vs TASKS.md
- **TASKS.md**: Actionable development tasks that Claude can work on autonomously
- **TODO.md**: Non-development tasks, notes, reminders that require human action (e.g., "Buy domain", "Schedule meeting", "Review pricing")

When planning or execution requires non-development tasks, they should be added to TODO.md instead of TASKS.md.

## Architecture

### Backend (Express)
The TODO.md API already exists in `admin/server/src/routes/projects.ts`:
- `GET /api/projects/:name/todo` - Get TODO.md content
- `PUT /api/projects/:name/todo` - Update/create TODO.md
- `DELETE /api/projects/:name/todo` - Delete TODO.md

Library functions in `admin/server/src/lib/projects.ts`:
- `getTodoMd(projectName)` - Returns content or null
- `updateTodoMd(projectName, content)` - Creates/updates file
- `deleteTodoMd(projectName)` - Deletes file

### Frontend (React + Vite)
API client in `admin/client/src/lib/api.ts` needs:
- `fetchTodoMd(projectName)` - GET call
- `updateTodoMd(projectName, content)` - PUT call
- `deleteTodoMd(projectName)` - DELETE call

UI in `admin/client/src/pages/ProjectDetail.tsx`:
- Add TODO.md card similar to CONTEXT.md card
- View/Edit/Create/Delete functionality

### Notifications
Using [sonner](https://sonner.emilkowal.ski/) for toast notifications:
- Admin UI: Toast on save/delete success/error
- GitHub Issues: Comment on issue when TODO.md is created/updated
- Email: Send notification email when TODO.md is created/updated

## Commands

### Development
```bash
# Start admin dashboard
cd ~/.pauly/admin && pnpm dev

# Or via pauly CLI
pauly admin start
```

### Build
```bash
cd ~/.pauly/admin/client && pnpm build
cd ~/.pauly/admin/server && pnpm build
```

## Files to Modify

### Frontend
- `admin/client/src/lib/api.ts` - Add TODO.md API functions
- `admin/client/src/pages/ProjectDetail.tsx` - Add TODO.md card UI
- `admin/client/package.json` - Add sonner dependency
- `admin/client/src/App.tsx` or Layout - Add Toaster component

### Backend
- `admin/server/src/lib/projects.ts` - Add hasTodoMd/todoMdContent to getProjectDetail

### Scripts
- `lib/dev.sh` - Update to move non-dev tasks to TODO.md
- `check-github-tasks.sh` - Add TODO.md notification comments
