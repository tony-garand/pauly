import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { ErrorDisplay } from "@/components/ui/error";
import {
  Bot,
  Clock,
  Folder,
  ScrollText,
  Settings,
  Play,
  Terminal,
  Pencil,
  Check,
  X,
  Trash2,
  Plus,
  Skull,
  Loader2,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import {
  fetchPaulyStatus,
  fetchPaulyConfig,
  updatePaulyConfig,
  deletePaulyConfig,
  killAllProcesses,
  gitPullPauly,
  type PaulyJob,
} from "@/lib/api";

export function Status() {
  const [jobs, setJobs] = useState<PaulyJob[]>([]);
  const [paulyDir, setPaulyDir] = useState<string>("");
  const [logsDir, setLogsDir] = useState<string>("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [killing, setKilling] = useState(false);
  const [killResult, setKillResult] = useState<{ killed: number } | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ output: string; updated: boolean } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, configRes] = await Promise.all([
        fetchPaulyStatus(),
        fetchPaulyConfig(),
      ]);
      setJobs(statusRes.jobs);
      setPaulyDir(statusRes.paulyDir);
      setLogsDir(statusRes.logsDir);
      setConfig(configRes.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const handleSave = async (key: string) => {
    try {
      await updatePaulyConfig(key, editValue);
      setConfig((prev) => ({ ...prev, [key]: editValue }));
      setEditingKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deletePaulyConfig(key);
      setConfig((prev) => {
        const newConfig = { ...prev };
        delete newConfig[key];
        return newConfig;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    try {
      await updatePaulyConfig(newKey.trim(), newValue);
      setConfig((prev) => ({ ...prev, [newKey.trim()]: newValue }));
      setNewKey("");
      setNewValue("");
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  };

  const handleKillAll = async () => {
    const confirmed = window.confirm(
      "⚠️ KILLSWITCH\n\nThis will terminate ALL running Claude and Pauly dev processes.\n\nAre you sure?"
    );
    if (!confirmed) return;

    setKilling(true);
    setKillResult(null);
    try {
      const result = await killAllProcesses();
      setKillResult({ killed: result.killed });
      setTimeout(() => setKillResult(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to kill processes");
    } finally {
      setKilling(false);
    }
  };

  const handleGitPull = async () => {
    setPulling(true);
    setPullResult(null);
    try {
      const result = await gitPullPauly();
      setPullResult({ output: result.output, updated: result.updated });
      setTimeout(() => setPullResult(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pull updates");
    } finally {
      setPulling(false);
    }
  };

  if (loading) {
    return <Loading message="Loading Pauly status..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pauly Status</h1>
        <p className="text-muted-foreground">
          Monitor Pauly jobs and configuration
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Bot className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Pauly Automation</p>
            <p className="text-muted-foreground text-sm">
              {jobs.length} scheduled job{jobs.length !== 1 ? "s" : ""} configured
            </p>
          </div>
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            Active
          </Badge>
        </CardContent>
      </Card>

      {/* Git Pull Card */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <GitBranch className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Update Pauly</p>
            <p className="text-muted-foreground text-sm">
              Pull latest changes from remote repository
            </p>
          </div>
          {pullResult && (
            <Badge variant="outline" className={pullResult.updated ? "border-green-500 text-green-500" : ""}>
              {pullResult.updated ? "Updated!" : "Already up to date"}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGitPull}
            disabled={pulling}
            className="gap-2"
          >
            {pulling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {pulling ? "Pulling..." : "Git Pull"}
          </Button>
        </CardContent>
      </Card>

      {/* Killswitch Card */}
      <Card className="border-destructive/50">
        <CardContent className="flex items-center gap-4 py-4">
          <Skull className="h-8 w-8 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium">Emergency Killswitch</p>
            <p className="text-muted-foreground text-sm">
              Stop all running Claude and dev processes
            </p>
          </div>
          {killResult && (
            <Badge variant="outline" className="mr-2">
              Killed {killResult.killed} process{killResult.killed !== 1 ? "es" : ""}
            </Badge>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleKillAll}
            disabled={killing}
            className="gap-2"
          >
            {killing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Skull className="h-4 w-4" />
            )}
            {killing ? "Stopping..." : "Kill All"}
          </Button>
        </CardContent>
      </Card>

      {/* Directory Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Pauly Directory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm bg-muted px-2 py-1 rounded">
              {paulyDir}
            </code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              Logs Directory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm bg-muted px-2 py-1 rounded">
              {logsDir}
            </code>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription>
            Cron jobs running via crontab
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.name}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-green-500" />
                      <span className="font-medium">{job.name}</span>
                    </div>
                    <Link to={`/logs/${job.name}`}>
                      <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                        View Logs
                      </Badge>
                    </Link>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Schedule:</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                        {job.schedule}
                      </code>
                    </div>
                    <div className="flex items-start gap-2">
                      <Terminal className="h-3 w-3 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">Command:</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                        {job.command}
                      </code>
                    </div>
                    {job.logFile && (
                      <div className="flex items-start gap-2">
                        <ScrollText className="h-3 w-3 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">Log file:</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                          {job.logFile}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No Pauly jobs found in crontab
            </p>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration
              </CardTitle>
              <CardDescription>
                Pauly config values (~/.config/pauly/config)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add new config form */}
          {showAddForm && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
              <Input
                placeholder="KEY_NAME"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                className="w-48 font-mono text-sm"
              />
              <Input
                placeholder="value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button size="sm" onClick={handleAdd} disabled={!newKey.trim()}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setNewKey("");
                  setNewValue("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {Object.keys(config).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(config).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-4 py-2 border-b last:border-0"
                >
                  <code className="text-sm font-medium min-w-[200px]">
                    {key}
                  </code>
                  {editingKey === key ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 font-mono text-sm"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSave(key)}
                      >
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingKey(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <code className="text-sm text-muted-foreground break-all flex-1">
                        {value}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(key, value)}
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(key)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No configuration found. Click Add to create one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
