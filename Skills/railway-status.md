# Railway Status

Check the deployment status of a Railway project.

## Prerequisites

- Railway CLI installed (`railway --version`)
- Authenticated with Railway (`railway login`)
- Project linked to Railway (`railway link`)

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| project | No | Project directory path (defaults to current directory) |

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

4. **Check project status**
   ```bash
   railway status
   ```

5. **Get additional deployment info** (optional)
   ```bash
   railway deployment
   ```

6. **Check service domains**
   ```bash
   railway domain
   ```

7. **Open project in browser** (optional)
   ```bash
   railway open
   ```

## Examples

### Example 1: Check basic status
```bash
railway status
```

### Example 2: View deployment details
```bash
railway deployment
```

### Example 3: Check all services status
```bash
railway service
```

### Example 4: Open Railway dashboard
```bash
railway open
```

### Example 5: Get project URL
```bash
railway domain
```

## Status Interpretation

### Deployment States

| Status | Meaning |
|--------|---------|
| `BUILDING` | Code is being built |
| `DEPLOYING` | Build complete, deploying to infrastructure |
| `SUCCESS` | Deployment successful and running |
| `FAILED` | Deployment failed |
| `CRASHED` | Service crashed after deployment |
| `REMOVED` | Deployment was removed |
| `SLEEPING` | Service is inactive (hobby plan) |

### Health States

| Status | Meaning |
|--------|---------|
| `HEALTHY` | All health checks passing |
| `UNHEALTHY` | Health checks failing |
| `UNKNOWN` | No health check configured |

## Error Handling

### Not authenticated
- **Symptom**: `Not logged in`
- **Solution**: Run `railway login` to authenticate

### Project not linked
- **Symptom**: `No project linked`
- **Solution**: Run `railway link` to link project first

### No deployments
- **Symptom**: `No deployments found`
- **Solution**: Deploy with `railway up` first

### Service crashed
- **Symptom**: Status shows `CRASHED`
- **Solution**: Check `railway logs` for error details

## Quick Health Check Script

```bash
#!/bin/bash
# Check if Railway project is healthy

status=$(railway status 2>&1)

if echo "$status" | grep -q "SUCCESS"; then
    echo "Deployment is healthy"
    exit 0
elif echo "$status" | grep -q "BUILDING\|DEPLOYING"; then
    echo "Deployment in progress"
    exit 0
else
    echo "Deployment issue detected"
    echo "$status"
    exit 1
fi
```

## Related Skills

- `railway-deploy.md` - Deploy if not deployed
- `railway-logs.md` - View logs if issues detected
- `railway-env.md` - Check environment configuration
