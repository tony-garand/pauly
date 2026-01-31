# Issue #28: TODO.md Management and Notifications

## Summary
Add TODO.md CRUD functionality to admin UI with notifications when files are updated via GitHub Issues, email, or the admin UI.

## Tasks

### Phase 1: TODO.md API Client Functions
- [x] Add TODO.md API functions to `admin/client/src/lib/api.ts` (getTodoMd, updateTodoMd, deleteTodoMd)
- [x] Add `hasTodoMd` and `todoMdContent` fields to ProjectDetail type

### Phase 2: Install Toast/Notification Library
- [x] Install sonner package in admin client (`pnpm add sonner`)
- [ ] Add Toaster component to App.tsx or Layout
- [ ] Create toast utility functions for success/error notifications

### Phase 3: TODO.md UI in ProjectDetail
- [ ] Add TODO.md card component (similar to CONTEXT.md card)
- [ ] Add view/edit/create/delete buttons
- [ ] Add textarea for editing TODO.md content
- [ ] Wire up save/delete handlers with API calls
- [ ] Show toast notifications on save/delete success/error

### Phase 4: Backend - Add hasTodoMd to Project Details
- [ ] Update `getProjectDetail` in `admin/server/src/lib/projects.ts` to include `hasTodoMd` and `todoMdContent`

### Phase 5: Notification on Issue/Email Creation
- [ ] When GitHub issue creates/updates TODO.md, comment on the issue
- [ ] When email task creates/updates TODO.md, send email notification
- [ ] When admin UI creates/updates TODO.md, show sonner toast

### Phase 6: Task Actionability
- [ ] Update dev scripts to move non-actionable tasks to TODO.md
- [ ] Document the TODO.md vs TASKS.md distinction
