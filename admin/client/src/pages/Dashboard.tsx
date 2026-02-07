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
import { Loading } from "@/components/ui/loading";
import { ErrorDisplay } from "@/components/ui/error";
import {
  FolderGit2,
  Terminal,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";
import {
  fetchHealth,
  fetchClis,
  fetchProjects,
  fetchPaulyStatus,
  type CliInfo,
  type ProjectInfo,
  type PaulyJob,
} from "@/lib/api";
import { ClaudeTerminal } from "@/components/ClaudeTerminal";

export function Dashboard() {
  const [health, setHealth] = useState<string | null>(null);
  const [clis, setClis] = useState<CliInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [jobs, setJobs] = useState<PaulyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, clisRes, projectsRes, statusRes] = await Promise.all([
        fetchHealth(),
        fetchClis(),
        fetchProjects(),
        fetchPaulyStatus(),
      ]);
      setHealth(healthRes.status);
      setClis(clisRes.clis);
      setProjects(projectsRes.projects);
      setJobs(statusRes.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <Loading message="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  const installedClis = clis.filter((c) => c.installed).length;
  const totalClis = clis.length;
  const projectsWithTasks = projects.filter((p) => p.tasksCompletion).length;
  const projectsWithGit = projects.filter((p) => p.hasGit).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your Pauly admin system
        </p>
      </div>

      {/* Status Banner */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <p className="text-sm font-medium">Server Status</p>
            <div className="flex items-center gap-2">
              {health === "ok" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-green-500 font-medium">Healthy</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-destructive font-medium">Unhealthy</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claude Terminal */}
      <ClaudeTerminal />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Projects Card */}
        <Link to="/projects">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projects</CardTitle>
              <FolderGit2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
              <p className="text-xs text-muted-foreground">
                {projectsWithGit} with git, {projectsWithTasks} with tasks
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* CLIs Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CLIs Installed</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {installedClis}/{totalClis}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalClis - installedClis} missing
            </p>
          </CardContent>
        </Card>

        {/* Jobs Card */}
        <Link to="/logs">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scheduled Jobs</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobs.length}</div>
              <p className="text-xs text-muted-foreground">Active cron jobs</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>Pauly Jobs</CardTitle>
          <CardDescription>Scheduled tasks running via cron</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.name}
                className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{job.name}</p>
                  <p className="text-sm text-muted-foreground">{job.schedule}</p>
                </div>
                <Link to={`/logs/${job.name}`}>
                  <Badge variant="outline">View Logs</Badge>
                </Link>
              </div>
            ))}
            {jobs.length === 0 && (
              <p className="text-sm text-muted-foreground">No jobs configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Your development projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.name}
                to={`/projects/${project.name}`}
                className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors"
              >
                <div>
                  <p className="font-medium">{project.name}</p>
                  <div className="flex gap-2 mt-1">
                    {project.hasGit && (
                      <Badge variant="secondary" className="text-xs">
                        git
                      </Badge>
                    )}
                    {project.hasContextMd && (
                      <Badge variant="secondary" className="text-xs">
                        CONTEXT.md
                      </Badge>
                    )}
                  </div>
                </div>
                {project.tasksCompletion && (
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {project.tasksCompletion.percentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {project.tasksCompletion.completed}/{project.tasksCompletion.total} tasks
                    </p>
                  </div>
                )}
              </Link>
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">No projects found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
