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
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
  Loader2,
} from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";

interface FailedTask {
  id: number;
  task_type: string;
  task_data: string;
  error_message: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  status: "pending" | "retrying" | "resolved" | "abandoned";
}

interface DeadLetterStats {
  total: number;
  pending: number;
  retrying: number;
  resolved: number;
  abandoned: number;
  byTaskType: { task_type: string; count: number }[];
}

const API_BASE = "/api";

async function fetchStats(): Promise<DeadLetterStats> {
  const res = await fetch(`${API_BASE}/deadletter/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchTasks(status?: string): Promise<{ tasks: FailedTask[] }> {
  const url = status
    ? `${API_BASE}/deadletter?status=${status}`
    : `${API_BASE}/deadletter`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

async function retryTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/deadletter/${id}/retry`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to retry task");
  }
}

async function resolveTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/deadletter/${id}/resolve`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to resolve task");
  }
}

async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/deadletter/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete task");
  }
}

async function cleanupTasks(days: number): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/deadletter/cleanup?days=${days}`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to cleanup tasks");
  }
  return res.json();
}

function StatusBadge({ status }: { status: FailedTask["status"] }) {
  const variants: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
    retrying: { color: "bg-blue-100 text-blue-800", icon: <RefreshCw className="h-3 w-3" /> },
    resolved: { color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3 w-3" /> },
    abandoned: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
  };

  const { color, icon } = variants[status] || variants.pending;

  return (
    <Badge className={`${color} gap-1`}>
      {icon}
      {status}
    </Badge>
  );
}

export function DeadLetter() {
  const [stats, setStats] = useState<DeadLetterStats | null>(null);
  const [tasks, setTasks] = useState<FailedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, tasksData] = await Promise.all([
        fetchStats(),
        fetchTasks(statusFilter || undefined),
      ]);
      setStats(statsData);
      setTasks(tasksData.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetry = async (id: number) => {
    setActionLoading(id);
    try {
      await retryTask(id);
      showSuccess("Task scheduled for retry");
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to retry");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (id: number) => {
    setActionLoading(id);
    try {
      await resolveTask(id);
      showSuccess("Task marked as resolved");
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    setActionLoading(id);
    try {
      await deleteTask(id);
      showSuccess("Task deleted");
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("Delete all resolved tasks older than 30 days?")) return;
    try {
      const { deleted } = await cleanupTasks(30);
      showSuccess(`Deleted ${deleted} old tasks`);
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to cleanup");
    }
  };

  if (loading && !stats) {
    return <Loading message="Loading dead-letter queue..." />;
  }

  if (error && !stats) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            Dead-Letter Queue
          </h1>
          <p className="text-muted-foreground">
            Failed tasks that need attention
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleCleanup}>
            <Archive className="h-4 w-4 mr-1" />
            Cleanup
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card
            className={`cursor-pointer ${statusFilter === "" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("")}
          >
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card
            className={`cursor-pointer ${statusFilter === "pending" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card
            className={`cursor-pointer ${statusFilter === "retrying" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("retrying")}
          >
            <CardHeader className="pb-2">
              <CardDescription>Retrying</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{stats.retrying}</CardTitle>
            </CardHeader>
          </Card>
          <Card
            className={`cursor-pointer ${statusFilter === "resolved" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("resolved")}
          >
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.resolved}</CardTitle>
            </CardHeader>
          </Card>
          <Card
            className={`cursor-pointer ${statusFilter === "abandoned" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("abandoned")}
          >
            <CardHeader className="pb-2">
              <CardDescription>Abandoned</CardDescription>
              <CardTitle className="text-2xl text-red-600">{stats.abandoned}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter ? `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Tasks` : "All Tasks"}
          </CardTitle>
          <CardDescription>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tasks in this queue</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 border rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.task_type}</span>
                        <StatusBadge status={task.status} />
                        <Badge variant="outline">
                          {task.retry_count}/{task.max_retries} retries
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(task.created_at).toLocaleString()}
                      </p>
                      {task.next_retry_at && task.status !== "resolved" && (
                        <p className="text-sm text-muted-foreground">
                          Next retry: {new Date(task.next_retry_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {task.status !== "resolved" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(task.id)}
                            disabled={actionLoading === task.id}
                            title="Retry now"
                          >
                            {actionLoading === task.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResolve(task.id)}
                            disabled={actionLoading === task.id}
                            title="Mark resolved"
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(task.id)}
                        disabled={actionLoading === task.id}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 bg-destructive/10 rounded border border-destructive/20">
                    <p className="text-sm font-mono text-destructive whitespace-pre-wrap">
                      {task.error_message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
