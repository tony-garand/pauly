import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { ErrorDisplay } from "@/components/ui/error";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Activity,
} from "lucide-react";

const API_BASE = "/api";

interface MetricsSummary {
  totalTasks: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  byTaskType: {
    task_type: string;
    total: number;
    success: number;
    failure: number;
    successRate: number;
    avgDuration: number;
  }[];
  recentFailures: {
    id: number;
    task_type: string;
    project_name: string | null;
    error_message: string | null;
    created_at: string;
  }[];
}

interface TimelinePoint {
  timestamp: string;
  success: number;
  failure: number;
}

async function fetchMetricsSummary(days: number): Promise<MetricsSummary> {
  const res = await fetch(`${API_BASE}/metrics/summary?days=${days}`);
  if (!res.ok) throw new Error("Failed to fetch metrics");
  return res.json();
}

async function fetchTimeline(days: number): Promise<{ timeline: TimelinePoint[] }> {
  const res = await fetch(`${API_BASE}/metrics/timeline?days=${days}`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function SimpleBarChart({ data }: { data: TimelinePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-muted-foreground">
        No data for the selected period
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.success + d.failure), 1);

  return (
    <div className="h-40 flex items-end gap-1">
      {data.map((point, i) => {
        const total = point.success + point.failure;
        const successHeight = total > 0 ? (point.success / maxValue) * 100 : 0;
        const failureHeight = total > 0 ? (point.failure / maxValue) * 100 : 0;

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${point.timestamp}: ${point.success} success, ${point.failure} failure`}>
            <div className="w-full flex flex-col gap-0.5" style={{ height: '120px' }}>
              <div
                className="w-full bg-red-500 rounded-t"
                style={{ height: `${failureHeight}%`, marginTop: 'auto' }}
              />
              <div
                className="w-full bg-green-500 rounded-b"
                style={{ height: `${successHeight}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {new Date(point.timestamp).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Metrics() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, timelineData] = await Promise.all([
        fetchMetricsSummary(days),
        fetchTimeline(days),
      ]);
      setSummary(summaryData);
      setTimeline(timelineData.timeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !summary) {
    return <Loading message="Loading metrics..." />;
  }

  if (error && !summary) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Metrics
          </h1>
          <p className="text-muted-foreground">
            Task execution analytics and performance
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border">
            {[7, 14, 30].map((d) => (
              <Button
                key={d}
                variant={days === d ? "default" : "ghost"}
                size="sm"
                onClick={() => setDays(d)}
                className="rounded-none first:rounded-l-md last:rounded-r-md"
              >
                {d}d
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Total Tasks
                </CardDescription>
                <CardTitle className="text-2xl">{summary.totalTasks}</CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  {summary.successRate >= 90 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  Success Rate
                </CardDescription>
                <CardTitle className={`text-2xl ${summary.successRate >= 90 ? "text-green-600" : summary.successRate >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                  {summary.successRate.toFixed(1)}%
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Successful
                </CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {summary.successCount}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  Failed
                </CardDescription>
                <CardTitle className="text-2xl text-red-600">
                  {summary.failureCount}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Task Execution Timeline</CardTitle>
              <CardDescription>
                Success and failure counts over the last {days} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={timeline} />
              <div className="flex justify-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Success</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded" />
                  <span>Failure</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* By Task Type */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Task Type</CardTitle>
              <CardDescription>
                Breakdown of metrics by task type
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary.byTaskType.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No task data for this period
                </div>
              ) : (
                <div className="space-y-4">
                  {summary.byTaskType.map((type) => (
                    <div key={type.task_type} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{type.task_type}</span>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{type.total} tasks</span>
                            <Badge variant={type.successRate >= 90 ? "default" : type.successRate >= 70 ? "secondary" : "destructive"}>
                              {type.successRate.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${type.successRate}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {type.success} success
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-500" />
                            {type.failure} failed
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(type.avgDuration)} avg
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Failures */}
          {summary.recentFailures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Recent Failures
                </CardTitle>
                <CardDescription>
                  Last {summary.recentFailures.length} failures
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.recentFailures.map((failure) => (
                    <div
                      key={failure.id}
                      className="p-3 border rounded-lg space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{failure.task_type}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(failure.created_at).toLocaleString()}
                        </span>
                      </div>
                      {failure.project_name && (
                        <p className="text-sm text-muted-foreground">
                          Project: {failure.project_name}
                        </p>
                      )}
                      {failure.error_message && (
                        <p className="text-sm text-destructive truncate">
                          {failure.error_message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
