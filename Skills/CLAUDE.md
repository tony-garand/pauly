# Pauly Skills

Skills are markdown files that provide structured instructions for Claude to execute specific tasks. Each skill defines a workflow that Claude can follow to accomplish a particular goal.

## How Skills Work

When you invoke a skill, Pauly loads the skill file and passes it to Claude as context. The skill file contains:
- **Description**: What the skill does
- **Prerequisites**: Requirements before running
- **Steps**: Ordered instructions to follow
- **Examples**: Usage examples
- **Error Handling**: Common issues and fixes

## Available Skills

### Railway Deployment Skills

| Skill | File | Description |
|-------|------|-------------|
| Deploy | `railway-deploy.md` | Deploy a project to Railway |
| Link | `railway-link.md` | Link local project to Railway project |
| Logs | `railway-logs.md` | View Railway deployment logs |
| Env | `railway-env.md` | Manage environment variables |
| Status | `railway-status.md` | Check deployment status |

## Using Skills

### Via Pauly CLI
```bash
pauly skill <skill-name> [options]
```

### Via GitHub Issue
Create an issue with the skill name in the title or body:
```
Title: Deploy my-project to Railway
Body: Use the railway-deploy skill
```

### Via Pauly Dev Task
```bash
pauly dev task "deploy to railway using railway-deploy skill"
```

## Skill File Format

Skills follow this structure:

```markdown
# Skill Name

Brief description of what this skill does.

## Prerequisites

- List of requirements
- Tools that must be installed
- Authentication needed

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| project | No | Project name or path |

## Steps

1. First step to execute
2. Second step with details
3. Continue until complete

## Examples

### Example 1: Basic Usage
\`\`\`bash
pauly skill railway-deploy
\`\`\`

### Example 2: With Options
\`\`\`bash
pauly skill railway-deploy --project my-app
\`\`\`

## Error Handling

### Common Issue 1
- **Symptom**: Description of the problem
- **Solution**: How to fix it

## Related Skills

- `other-skill.md` - Description
```

## Creating New Skills

1. Create a new `.md` file in `~/.pauly/Skills/`
2. Follow the skill file format above
3. Test the skill manually first
4. Document any prerequisites clearly

## Best Practices

- **Be specific**: Include exact commands to run
- **Handle errors**: Anticipate common failure modes
- **Check prerequisites**: Verify tools/auth before proceeding
- **Provide context**: Explain why each step is needed
- **Keep it focused**: One skill = one task
