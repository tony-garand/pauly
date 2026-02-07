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
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { ErrorDisplay } from "@/components/ui/error";
import {
  CheckCircle2,
  XCircle,
  Terminal,
  Package,
  Plus,
  Trash2,
  Download,
  Loader2,
} from "lucide-react";
import { fetchClis, addCli, removeCli, installCli, getInstallStatus, type CliInfo } from "@/lib/api";

export function CLIs() {
  const [clis, setClis] = useState<CliInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCliName, setNewCliName] = useState("");
  const [newCliVersionFlag, setNewCliVersionFlag] = useState("--version");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<Record<string, "running" | "success" | "error">>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchClis();
      setClis(res.clis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CLIs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCliName.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await addCli(newCliName.trim(), newCliVersionFlag.trim() || "--version");
      setNewCliName("");
      setNewCliVersionFlag("--version");
      await loadData();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add CLI");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await removeCli(name);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove CLI");
    }
  };

  const handleInstall = async (name: string) => {
    setInstalling((prev) => ({ ...prev, [name]: "running" }));
    try {
      await installCli(name);
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const status = await getInstallStatus(name);
          if (status.status !== "running") {
            clearInterval(pollInterval);
            setInstalling((prev) => ({ ...prev, [name]: status.status }));
            if (status.status === "success") {
              await loadData();
            }
          }
        } catch {
          clearInterval(pollInterval);
          setInstalling((prev) => ({ ...prev, [name]: "error" }));
        }
      }, 2000);
    } catch {
      setInstalling((prev) => ({ ...prev, [name]: "error" }));
    }
  };

  if (loading) {
    return <Loading message="Loading CLI tools..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  const installedClis = clis.filter((c) => c.installed);
  const missingClis = clis.filter((c) => !c.installed);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Command Line Tools</h1>
        <p className="text-muted-foreground">
          Status of required CLI tools on your system
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Terminal className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">CLI Status</p>
            <p className="text-muted-foreground text-sm">
              {installedClis.length} of {clis.length} tools installed
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              {installedClis.length} Installed
            </Badge>
            {missingClis.length > 0 && (
              <Badge variant="destructive">
                {missingClis.length} Missing
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add CLI Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add CLI
          </CardTitle>
          <CardDescription>
            Track additional command line tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-3">
            <Input
              placeholder="CLI name (e.g., nvim)"
              value={newCliName}
              onChange={(e) => setNewCliName(e.target.value)}
              className="flex-1 font-mono"
            />
            <Input
              placeholder="Version flag"
              value={newCliVersionFlag}
              onChange={(e) => setNewCliVersionFlag(e.target.value)}
              className="w-32 font-mono"
            />
            <Button type="submit" disabled={adding || !newCliName.trim()}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </form>
          {addError && (
            <p className="text-sm text-destructive mt-2">{addError}</p>
          )}
        </CardContent>
      </Card>

      {/* Installed CLIs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Installed
          </CardTitle>
          <CardDescription>
            These tools are available on your system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {installedClis.map((cli) => (
              <div
                key={cli.name}
                className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium font-mono">{cli.name}</p>
                      {cli.isCustom && (
                        <Badge variant="outline" className="text-xs">custom</Badge>
                      )}
                    </div>
                    {cli.path && (
                      <p className="text-xs text-muted-foreground truncate max-w-md">
                        {cli.path}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cli.version && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {cli.version}
                    </Badge>
                  )}
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {cli.isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(cli.name)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {installedClis.length === 0 && (
              <p className="text-sm text-muted-foreground">No CLIs installed</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Missing CLIs */}
      {missingClis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Missing
            </CardTitle>
            <CardDescription>
              These tools need to be installed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {missingClis.map((cli) => {
                const installStatus = installing[cli.name];
                return (
                  <div
                    key={cli.name}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <p className="font-medium font-mono">{cli.name}</p>
                        {cli.isCustom && (
                          <Badge variant="outline" className="text-xs">custom</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {installStatus === "running" ? (
                        <Badge variant="secondary" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Installing...
                        </Badge>
                      ) : installStatus === "error" ? (
                        <Badge variant="destructive">Install Failed</Badge>
                      ) : (
                        <Badge variant="destructive">Not Found</Badge>
                      )}
                      {!installStatus || installStatus === "error" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInstall(cli.name)}
                          className="h-7 text-xs gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Install
                        </Button>
                      ) : null}
                      {cli.isCustom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(cli.name)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
