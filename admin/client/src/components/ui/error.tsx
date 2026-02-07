import { AlertCircle, RefreshCw, Lightbulb, Copy, Check } from "lucide-react";
import { Card, CardContent } from "./card";
import { useState } from "react";

// Error suggestions mapping - mirrors server-side patterns
const errorSuggestions: { pattern: RegExp; suggestion: string; action?: string }[] = [
  { pattern: /ENOENT/i, suggestion: "File or directory not found. Check if the path exists.", action: "ls -la" },
  { pattern: /EACCES|permission denied/i, suggestion: "Permission denied. Check file permissions.", action: "chmod +x" },
  { pattern: /ECONNREFUSED/i, suggestion: "Connection refused. Is the server running?", action: "Check service status" },
  { pattern: /ETIMEDOUT|timeout/i, suggestion: "Operation timed out. Check network or increase timeout." },
  { pattern: /rate limit/i, suggestion: "API rate limit reached. Wait before retrying.", action: "Wait 60 seconds" },
  { pattern: /session limit/i, suggestion: "Claude session limit reached. Wait or restart session.", action: "pauly kill && pauly dev" },
  { pattern: /out of memory|heap/i, suggestion: "Out of memory. Close other applications or increase Node memory." },
  { pattern: /git.*conflict/i, suggestion: "Git merge conflict detected. Resolve conflicts manually.", action: "git status" },
  { pattern: /npm ERR!|pnpm ERR!/i, suggestion: "Package manager error. Try clearing cache and reinstalling.", action: "rm -rf node_modules && pnpm install" },
  { pattern: /cannot find module/i, suggestion: "Missing dependency. Try reinstalling packages.", action: "pnpm install" },
  { pattern: /EADDRINUSE/i, suggestion: "Port already in use. Kill the process using it.", action: "lsof -i :PORT" },
  { pattern: /authentication|unauthorized|401/i, suggestion: "Authentication failed. Check credentials or re-login." },
  { pattern: /not found.*command|command not found/i, suggestion: "Command not found. Make sure the CLI tool is installed." },
  { pattern: /fetch failed|network/i, suggestion: "Network error. Check your connection and try again." },
  { pattern: /syntax error/i, suggestion: "Syntax error in code. Check the file at the indicated line." },
  { pattern: /FAIL.*\.test\./i, suggestion: "Test failure. Check test output for details." },
  { pattern: /clone failed/i, suggestion: "Git clone failed. Check the repository URL and your permissions.", action: "gh auth status" },
  { pattern: /directory already exists/i, suggestion: "A project with this name already exists. Choose a different name." },
];

function getErrorSuggestion(message: string): { suggestion: string; action?: string } | undefined {
  for (const { pattern, suggestion, action } of errorSuggestions) {
    if (pattern.test(message)) {
      return { suggestion, action };
    }
  }
  return undefined;
}

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  context?: string;
}

export function ErrorDisplay({ message, onRetry, context }: ErrorDisplayProps) {
  const [copied, setCopied] = useState(false);
  const suggestion = getErrorSuggestion(message);

  const copyAction = async (action: string) => {
    await navigator.clipboard.writeText(action);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center h-64">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div className="text-center">
            <p className="font-medium text-destructive">Error</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
            {context && (
              <p className="text-xs text-muted-foreground/70 mt-1">Context: {context}</p>
            )}
          </div>

          {/* Error suggestion */}
          {suggestion && (
            <div className="w-full p-3 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm">{suggestion.suggestion}</p>
                  {suggestion.action && (
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-background px-2 py-1 rounded border flex-1 font-mono">
                        {suggestion.action}
                      </code>
                      <button
                        onClick={() => copyAction(suggestion.action!)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Copy command"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-muted transition-colors text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
