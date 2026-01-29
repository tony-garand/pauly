import { AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "./card";

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex items-center justify-center h-64">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div className="text-center">
            <p className="font-medium text-destructive">Error</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
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
