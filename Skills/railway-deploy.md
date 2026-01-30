# Railway Deploy

Deploy a project to Railway platform.

## Prerequisites

- Railway CLI installed (`railway --version`)
- Authenticated with Railway (`railway login`)
- Project linked to Railway (`railway link`) or will create new project

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| project | No | Project directory path (defaults to current directory) |
| detach | No | Deploy without watching logs (--detach flag) |

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

4. **Check if project is linked to Railway**
   ```bash
   railway status
   ```
   If not linked, either:
   - Run `railway link` to link to existing project
   - Run `railway init` to create new project

5. **Deploy the project**
   ```bash
   railway up
   ```
   Or for detached deployment:
   ```bash
   railway up --detach
   ```

6. **Verify deployment**
   ```bash
   railway status
   ```

7. **Get deployment URL**
   ```bash
   railway domain
   ```

## Examples

### Example 1: Deploy current directory
```bash
railway up
```

### Example 2: Deploy without watching logs
```bash
railway up --detach
```

### Example 3: Deploy specific service
```bash
railway up --service web
```

## Error Handling

### Not authenticated
- **Symptom**: `Not logged in`
- **Solution**: Run `railway login` to authenticate

### Project not linked
- **Symptom**: `No project linked`
- **Solution**: Run `railway link` to link existing project or `railway init` for new

### Build failed
- **Symptom**: Build errors in logs
- **Solution**: Check `railway logs` for details, fix code issues

### No Dockerfile or nixpacks config
- **Symptom**: `Unable to determine build method`
- **Solution**: Add Dockerfile, nixpacks.toml, or ensure package.json/requirements.txt exists

## Related Skills

- `railway-link.md` - Link project before deploying
- `railway-logs.md` - View deployment logs
- `railway-status.md` - Check deployment status
