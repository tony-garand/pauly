# Railway Env

Manage environment variables for Railway deployments.

## Prerequisites

- Railway CLI installed (`railway --version`)
- Authenticated with Railway (`railway login`)
- Project linked to Railway (`railway link`)

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| project | No | Project directory path (defaults to current directory) |
| action | No | Action to perform: list, set, unset (default: list) |
| key | Conditional | Variable name (required for set/unset) |
| value | Conditional | Variable value (required for set) |

## Steps

### List Environment Variables

1. **Navigate to project directory**
   ```bash
   cd <project-path>
   ```

2. **List all variables**
   ```bash
   railway variables
   ```

### Set Environment Variable

1. **Navigate to project directory**
   ```bash
   cd <project-path>
   ```

2. **Set the variable**
   ```bash
   railway variables set KEY=value
   ```

3. **Verify the variable was set**
   ```bash
   railway variables | grep KEY
   ```

### Unset Environment Variable

1. **Navigate to project directory**
   ```bash
   cd <project-path>
   ```

2. **Remove the variable**
   ```bash
   railway variables unset KEY
   ```

3. **Verify removal**
   ```bash
   railway variables
   ```

## Examples

### Example 1: List all environment variables
```bash
railway variables
```

### Example 2: Set a single variable
```bash
railway variables set DATABASE_URL="postgresql://user:pass@host:5432/db"
```

### Example 3: Set multiple variables
```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set API_KEY=secret123
```

### Example 4: Remove a variable
```bash
railway variables unset DEBUG
```

### Example 5: Copy variables to .env file
```bash
railway variables > .env
```

### Example 6: Set variable for specific service
```bash
railway variables set KEY=value --service web
```

## Error Handling

### Not authenticated
- **Symptom**: `Not logged in`
- **Solution**: Run `railway login` to authenticate

### Project not linked
- **Symptom**: `No project linked`
- **Solution**: Run `railway link` to link project first

### Invalid variable format
- **Symptom**: `Invalid variable format`
- **Solution**: Use `KEY=value` format (no spaces around =)

### Variable not found
- **Symptom**: `Variable not found`
- **Solution**: Check spelling with `railway variables`

## Security Notes

- Never commit `.env` files with secrets to git
- Use Railway's built-in variable management for secrets
- Variables are encrypted at rest in Railway
- Consider using Railway's shared variables for common config

## Common Variables

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | Node.js environment (production/development) |
| `PORT` | Application port (Railway sets this automatically) |
| `DATABASE_URL` | Database connection string |
| `REDIS_URL` | Redis connection string |
| `API_KEY` | External API keys |
| `JWT_SECRET` | JWT signing secret |

## Related Skills

- `railway-deploy.md` - Deploy after setting variables
- `railway-status.md` - Check current configuration
- `railway-link.md` - Link project before managing variables
