import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { ErrorDisplay } from "@/components/ui/error";
import { ImportRepoDialog } from "@/components/ImportRepoDialog";
import {
  FolderGit2,
  GitBranch,
  FileText,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { fetchProjects, type ProjectInfo } from "@/lib/api";

export function Projects() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProjects();
      setProjects(res.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll for updates every 10 seconds to catch dev status changes
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return <Loading message="Loading projects..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  const projectsWithGit = projects.filter((p) => p.hasGit).length;
  const projectsWithTasks = projects.filter((p) => p.tasksCompletion).length;
  const projectsWithDevRunning = projects.filter((p) => p.devStatus?.status === "running").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Your development projects in ~/Projects
          </p>
        </div>
        <ImportRepoDialog onSuccess={loadData} />
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <FolderGit2 className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Project Summary</p>
            <p className="text-muted-foreground text-sm">
              {projects.length} projects found
            </p>
          </div>
          <div className="flex gap-2">
            {projectsWithDevRunning > 0 && (
              <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 gap-1">
                <Sparkles className="h-3 w-3 animate-pulse" />
                {projectsWithDevRunning} dev running
              </Badge>
            )}
            <Badge variant="secondary">
              {projectsWithGit} with git
            </Badge>
            <Badge variant="secondary">
              {projectsWithTasks} with tasks
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Projects List */}
      <Card>
        <CardContent className="divide-y p-0">
          {projects.map((project) => (
            <Link
              key={project.name}
              to={`/projects/${project.name}`}
              className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              <FolderGit2 className="h-5 w-5 text-muted-foreground shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{project.name}</p>
                  {project.githubUrl && (
                    <a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{project.path}</p>
              </div>

              {/* Status Badges */}
              <div className="flex gap-1.5 shrink-0">
                {/* Dev Status */}
                {project.devStatus?.status === "running" && (
                  <Badge
                    variant="default"
                    className={`text-xs gap-1 ${project.devStatus.hasError ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-500 hover:bg-blue-600"}`}
                  >
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    {project.devStatus.hasError ? "Running (errors)" : "Dev Running"}
                  </Badge>
                )}
                {project.devStatus?.status === "success" && (
                  <Badge variant="default" className="text-xs gap-1 bg-green-500 hover:bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Complete
                  </Badge>
                )}
                {project.devStatus?.status === "error" && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Error
                  </Badge>
                )}
                {project.hasGit && (
                  <Badge variant="outline" className="text-xs">
                    <GitBranch className="h-3 w-3 mr-1" />
                    git
                  </Badge>
                )}
                {project.hasContextMd && (
                  <Badge variant="outline" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    CONTEXT.md
                  </Badge>
                )}
              </div>

              {/* Task Progress */}
              {project.tasksCompletion ? (
                <div className="flex items-center gap-2 shrink-0 w-32">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${project.tasksCompletion.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {project.tasksCompletion.percentage}%
                  </span>
                </div>
              ) : (
                <div className="w-32 shrink-0">
                  <span className="text-xs text-muted-foreground">No tasks</span>
                </div>
              )}
            </Link>
          ))}
        </CardContent>
      </Card>

      {projects.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No projects found in ~/Projects</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
