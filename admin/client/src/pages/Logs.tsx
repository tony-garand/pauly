import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { ErrorDisplay } from "@/components/ui/error";
import {
  ScrollText,
  RefreshCw,
  Clock,
  FileText,
  ArrowLeft,
  Play,
  Pause,
} from "lucide-react";
import {
  fetchAvailableLogs,
  fetchLogContent,
  type LogInfo,
  type LogContent,
} from "@/lib/api";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function Logs() {
  const { job } = useParams<{ job?: string }>();
  const [availableLogs, setAvailableLogs] = useState<LogInfo[]>([]);
  const [logContent, setLogContent] = useState<LogContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const logContainerRef = useRef<HTMLPreElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLogContent = useCallback(async () => {
    if (!job) return;
    try {
      const res = await fetchLogContent(job);
      setLogContent(res.log);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load log");
    }
  }, [job]);

  const loadAvailableLogs = useCallback(async () => {
    try {
      const res = await fetchAvailableLogs();
      setAvailableLogs(res.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await loadAvailableLogs();
      if (job) {
        await loadLogContent();
      }
      setLoading(false);
    }
    loadData();
  }, [job, loadAvailableLogs, loadLogContent]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh && job) {
      intervalRef.current = setInterval(() => {
        loadLogContent();
      }, refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, job, loadLogContent]);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (logContainerRef.current && autoRefresh) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logContent, autoRefresh]);

  const handleManualRefresh = () => {
    loadLogContent();
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const handleRetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadAvailableLogs();
    if (job) {
      await loadLogContent();
    }
    setLoading(false);
  }, [job, loadAvailableLogs, loadLogContent]);

  if (loading) {
    return <Loading message={job ? "Loading log content..." : "Loading logs..."} />;
  }

  if (error && !job) {
    return <ErrorDisplay message={error} onRetry={handleRetry} />;
  }

  // Log list view (no job selected)
  if (!job) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-muted-foreground">
            View Pauly job logs
          </p>
        </div>

        {/* Summary Card */}
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <ScrollText className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Available Logs</p>
              <p className="text-muted-foreground text-sm">
                {availableLogs.length} log file{availableLogs.length !== 1 ? "s" : ""} found
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle>Log Files</CardTitle>
            <CardDescription>
              Click a log to view its contents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableLogs.length > 0 ? (
              <div className="space-y-2">
                {availableLogs.map((log) => (
                  <Link
                    key={log.name}
                    to={`/logs/${log.name}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{log.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {log.path}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatBytes(log.size)}</span>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(log.lastModified).toLocaleDateString()}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No log files found in ~/.pauly/logs
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Log content view (job selected)
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/logs"
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Logs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6" />
            {job}
          </h1>
          {logContent && (
            <p className="text-muted-foreground text-sm mt-1">{logContent.path}</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            {/* Auto-refresh toggle */}
            <button
              onClick={toggleAutoRefresh}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors ${
                autoRefresh
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              {autoRefresh ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="text-sm">Auto-refresh</span>
            </button>

            {/* Refresh interval selector */}
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-2 py-1.5 text-sm border rounded-md bg-background"
              >
                <option value={2}>2s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
              </select>
            )}

            {/* Manual refresh button */}
            <button
              onClick={handleManualRefresh}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm">Refresh</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {logContent && (
              <>
                <span>{formatBytes(logContent.size)}</span>
                {lastRefresh && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lastRefresh.toLocaleTimeString()}
                  </span>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log Content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Log Output</CardTitle>
          {autoRefresh && (
            <CardDescription className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Auto-refreshing every {refreshInterval}s
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-destructive">{error}</div>
          ) : logContent ? (
            <pre
              ref={logContainerRef}
              className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs font-mono whitespace-pre-wrap break-all"
            >
              {logContent.content || "(empty log file)"}
            </pre>
          ) : (
            <p className="text-muted-foreground">Log not found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
