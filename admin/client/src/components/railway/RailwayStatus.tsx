import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Train,
  RefreshCw,
} from "lucide-react";
import type { RailwayStatus as RailwayStatusType } from "@/lib/api";

interface RailwayStatusProps {
  status: RailwayStatusType | null;
  onRefresh?: () => void;
  loading?: boolean;
}

export function RailwayStatus({ status, onRefresh, loading }: RailwayStatusProps) {
  const isAuthenticated = status?.authenticated ?? false;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <Train className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Railway Status</p>
          {isAuthenticated ? (
            <p className="text-muted-foreground text-sm">
              Logged in as {status?.user || "unknown"}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Not authenticated
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Not Connected
            </Badge>
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
