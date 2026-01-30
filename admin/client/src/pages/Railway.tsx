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
  CheckCircle2,
  XCircle,
  Train,
  Rocket,
  RefreshCw,
  ExternalLink,
  LogIn,
  ScrollText,
  Loader2,
} from "lucide-react";
import {
  fetchRailwayStatus,
  fetchRailwayProjects,
  fetchRailwayDeployments,
  deployToRailway,
  fetchRailwayLogs,
  type RailwayStatus,
  type RailwayProject,
  type RailwayDeployment,
} from "@/lib/api";

export function Railway() {
  const [status, setStatus] = useState<RailwayStatus | null>(null);
  const [projects, setProjects] = useState<RailwayProject[]>([]);
  const [deployments, setDeployments] = useState<RailwayDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ projectId: string; content: string } | null>(null);
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, projectsRes, deploymentsRes] = await Promise.all([
        fetchRailwayStatus(),
        fetchRailwayProjects().catch(() => ({ projects: [] })),
        fetchRailwayDeployments().catch(() => ({ deployments: [] })),
      ]);
      setStatus(statusRes);
      setProjects(projectsRes.projects);
      setDeployments(deploymentsRes.deployments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Railway data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeploy = async (projectId: string) => {
    setDeploying(projectId);
    try {
      await deployToRailway(projectId, true);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setDeploying(null);
    }
  };

  const handleViewLogs = async (projectId: string) => {
    setLoadingLogs(projectId);
    try {
      const res = await fetchRailwayLogs(projectId, 100);
      setLogs({ projectId, content: res.logs });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoadingLogs(null);
    }
  };

  if (loading) {
    return <Loading message="Loading Railway status..." />;
  }

  if (error && !status) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  const isAuthenticated = status?.authenticated ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Railway</h1>
          <p className="text-muted-foreground">
            Manage Railway deployments and projects
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
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
          </div>
        </CardContent>
      </Card>

      {/* Not Authenticated State */}
      {!isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              You need to log in to Railway to manage deployments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Run the following command in your terminal to authenticate:
            </p>
            <code className="block bg-muted p-3 rounded-md font-mono text-sm">
              railway login
            </code>
            <p className="text-sm text-muted-foreground">
              Or use the Pauly CLI:
            </p>
            <code className="block bg-muted p-3 rounded-md font-mono text-sm">
              pauly railway login
            </code>
            <Button variant="outline" onClick={loadData} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Projects
            </CardTitle>
            <CardDescription>
              Your Railway projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No projects found</p>
                <p className="text-sm mt-2">
                  Create a new project with <code className="bg-muted px-1 rounded">railway init</code>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Train className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {project.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {project.environments && project.environments.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {project.environments.length} env
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewLogs(project.id)}
                        disabled={loadingLogs === project.id}
                        className="h-7 text-xs gap-1"
                      >
                        {loadingLogs === project.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ScrollText className="h-3 w-3" />
                        )}
                        Logs
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDeploy(project.id)}
                        disabled={deploying === project.id}
                        className="h-7 text-xs gap-1"
                      >
                        {deploying === project.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Rocket className="h-3 w-3" />
                        )}
                        Deploy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logs Viewer */}
      {logs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ScrollText className="h-5 w-5" />
                Logs: {logs.projectId}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs(null)}
              >
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
              {logs.content || "No logs available"}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Recent Deployments */}
      {isAuthenticated && deployments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Recent Deployments
            </CardTitle>
            <CardDescription>
              Your latest Railway deployments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Rocket className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium font-mono text-sm">{deployment.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(deployment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      deployment.status === "SUCCESS"
                        ? "default"
                        : deployment.status === "BUILDING" || deployment.status === "DEPLOYING"
                        ? "secondary"
                        : "destructive"
                    }
                    className={deployment.status === "SUCCESS" ? "bg-green-500" : ""}
                  >
                    {deployment.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      {isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://railway.app/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Railway Dashboard
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://docs.railway.com"
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Documentation
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
