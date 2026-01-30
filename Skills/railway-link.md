# Railway Link

Link a local project directory to an existing Railway project.

## Prerequisites

- Railway CLI installed (`railway --version`)
- Authenticated with Railway (`railway login`)
- Existing Railway project to link to

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| project | No | Project directory path (defaults to current directory) |
| project-id | No | Railway project ID to link to (will prompt if not provided) |

## Steps

1. **Verify Railway CLI is installed**
   ```bash
   railway --version
   ```

2. **Check Railway authentication**
   ```bash
   railway whoami
   ```
   If not authenticated, run `railway login` first.

3. **Navigate to project directory** (if specified)
   ```bash
   cd <project-path>
   ```

4. **List available projects** (optional)
   ```bash
   railway list
   ```

5. **Link to Railway project**
   ```bash
   railway link
   ```
   This will prompt you to select a project interactively.

   Or link directly with project ID:
   ```bash
   railway link <project-id>
   ```

6. **Select environment** (if prompted)
   Choose the environment (e.g., production, staging)

7. **Select service** (if prompted)
   Choose the service within the project

8. **Verify link**
   ```bash
   railway status
   ```

## Examples

### Example 1: Interactive linking
```bash
railway link
# Follow prompts to select project, environment, and service
```

### Example 2: Link with project ID
```bash
railway link abc123-def456-ghi789
```

### Example 3: Link in specific directory
```bash
cd ~/Projects/my-app
railway link
```

## Error Handling

### Not authenticated
- **Symptom**: `Not logged in`
- **Solution**: Run `railway login` to authenticate

### No projects found
- **Symptom**: `No projects found`
- **Solution**: Create a project first with `railway init` or via Railway dashboard

### Already linked
- **Symptom**: `Project already linked`
- **Solution**: Run `railway unlink` first, then link to new project

### Invalid project ID
- **Symptom**: `Project not found`
- **Solution**: Verify project ID with `railway list`

## Related Skills

- `railway-deploy.md` - Deploy after linking
- `railway-status.md` - Verify link status
- `railway-env.md` - Manage environment variables after linking
