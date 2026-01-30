# Railway Logs

View deployment logs from Railway.

## Prerequisites

- Railway CLI installed (`railway --version`)
- Authenticated with Railway (`railway login`)
- Project linked to Railway (`railway link`)

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| project | No | Project directory path (defaults to current directory) |
| follow | No | Stream logs in real-time (--follow flag) |
| deployment | No | Specific deployment ID to view logs for |
| lines | No | Number of lines to show (default: 100) |

## Steps

1. **Verify Railway CLI is installed**
   ```bash
   railway --version
   ```

2. **Check Railway authentication**
   ```bash
   railway whoami
   ```

3. **Navigate to project directory** (if specified)
   ```bash
   cd <project-path>
   ```

4. **Verify project is linked**
   ```bash
   railway status
   ```

5. **View logs**
   ```bash
   railway logs
   ```

   For real-time streaming:
   ```bash
   railway logs --follow
   ```

6. **Filter or search logs** (if needed)
   ```bash
   railway logs | grep "error"
   ```

## Examples

### Example 1: View recent logs
```bash
railway logs
```

### Example 2: Stream logs in real-time
```bash
railway logs --follow
```

### Example 3: View logs for specific deployment
```bash
railway logs --deployment <deployment-id>
```

### Example 4: View build logs
```bash
railway logs --build
```

### Example 5: Filter logs for errors
```bash
railway logs | grep -i error
```

## Error Handling

### Not authenticated
- **Symptom**: `Not logged in`
- **Solution**: Run `railway login` to authenticate

### Project not linked
- **Symptom**: `No project linked`
- **Solution**: Run `railway link` to link project first

### No deployments
- **Symptom**: `No deployments found`
- **Solution**: Deploy first with `railway up`

### Service not selected
- **Symptom**: `Multiple services found`
- **Solution**: Specify service with `railway logs --service <name>`

## Log Interpretation

### Common Log Patterns

| Pattern | Meaning |
|---------|---------|
| `Build started` | Deployment build beginning |
| `Build successful` | Build completed, starting deploy |
| `Healthcheck passed` | Service is healthy and running |
| `Healthcheck failed` | Service failed to start properly |
| `OOM` | Out of memory - increase resources |
| `SIGTERM` | Service being shut down |

## Related Skills

- `railway-deploy.md` - Deploy to generate new logs
- `railway-status.md` - Check deployment status
