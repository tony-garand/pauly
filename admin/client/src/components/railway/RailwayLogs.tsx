import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollText, X, RefreshCw, Loader2 } from "lucide-react";

interface RailwayLogsProps {
  projectId: string;
  content: string;
  onClose?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function RailwayLogs({
  projectId,
  content,
  onClose,
  onRefresh,
  loading,
}: RailwayLogsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Logs: {projectId}
          </span>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted p-4 rounded-md font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
          {content || "No logs available"}
        </pre>
      </CardContent>
    </Card>
  );
}
