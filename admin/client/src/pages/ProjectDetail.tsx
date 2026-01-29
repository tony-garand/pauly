import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
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
  FolderGit2,
  GitBranch,
  FileText,
  ExternalLink,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Clock,
  FilePlus,
  FileEdit,
  Files,
  Plus,
  Trash2,
  Loader2,
  MessageSquarePlus,
} from "lucide-react";
import {
  fetchProjectDetail,
  addProjectTask,
  toggleProjectTask,
  deleteProjectTask,
  createProjectIssue,
  getIssueJobStatus,
  type ProjectDetail as ProjectDetailType,
} from "@/lib/api";

export function ProjectDetail() {
  const { name } = useParams<{ name: string }>();
  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueBody, setIssueBody] = useState("");
  const [creatingIssue, setCreatingIssue] = useState(false);

  const loadData = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProjectDetail(name);
      setProject(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !newTaskText.trim()) return;
    setAddingTask(true);
    try {
      await addProjectTask(name, newTaskText.trim());
      setNewTaskText("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (index: number) => {
    if (!name) return;
    try {
      await toggleProjectTask(name, index);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle task");
    }
  };

  const handleDeleteTask = async (index: number) => {
    if (!name) return;
    try {
      await deleteProjectTask(name, index);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !issueTitle.trim()) return;
    setCreatingIssue(true);
    try {
      const { jobId } = await createProjectIssue(name, issueTitle.trim(), issueBody.trim());

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const status = await getIssueJobStatus(name, jobId);
          if (status.status !== "running") {
            clearInterval(pollInterval);
            setCreatingIssue(false);
            if (status.status === "success") {
              setIssueTitle("");
              setIssueBody("");
              setShowIssueForm(false);
              await loadData();
            } else {
              setError("Failed to generate tasks: " + status.output);
            }
          }
        } catch {
          clearInterval(pollInterval);
          setCreatingIssue(false);
          setError("Failed to check issue status");
        }
      }, 2000);
    } catch (err) {
      setCreatingIssue(false);
      setError(err instanceof Error ? err.message : "Failed to create issue");
    }
  };

  if (loading) {
    return <Loading message="Loading project details..." />;
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Link
          to="/projects"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <ErrorDisplay message={error || "Project not found"} onRetry={loadData} />
      </div>
    );
  }

  const completedTasks = project.tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = project.tasks?.length ?? 0;
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/projects"
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderGit2 className="h-6 w-6" />
            {project.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{project.path}</p>
        </div>
        {project.githubUrl && (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            GitHub
          </a>
        )}
      </div>

      {/* Status badges and info */}
      <div className="flex flex-wrap gap-2">
        {project.hasGit && (
          <Badge variant="outline">
            <GitBranch className="h-3 w-3 mr-1" />
            {project.gitBranch || "git"}
          </Badge>
        )}
        {project.hasContextMd && (
          <Badge variant="outline">
            <FileText className="h-3 w-3 mr-1" />
            CONTEXT.md
          </Badge>
        )}
        {project.tasks && (
          <Badge variant="outline">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            TASKS.md
          </Badge>
        )}
        {project.lastModified && (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {new Date(project.lastModified).toLocaleDateString()}
          </Badge>
        )}
      </div>

      {/* Git Status Card */}
      {project.gitStatus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Git Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <FilePlus className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  <span className="font-medium">{project.gitStatus.staged}</span> staged
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileEdit className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">
                  <span className="font-medium">{project.gitStatus.modified}</span> modified
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Files className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">{project.gitStatus.untracked}</span> untracked
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Tasks
              </CardTitle>
              <CardDescription>
                {totalTasks > 0
                  ? `${completedTasks} of ${totalTasks} tasks completed`
                  : "No tasks yet"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {totalTasks > 0 && (
                <div className="text-right mr-4">
                  <p className="text-2xl font-bold">{percentage}%</p>
                  <p className="text-xs text-muted-foreground">complete</p>
                </div>
              )}
              <Button
                variant={showIssueForm ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowIssueForm(!showIssueForm)}
                className="gap-1"
              >
                <MessageSquarePlus className="h-4 w-4" />
                New Issue
              </Button>
            </div>
          </div>
          {/* Progress bar */}
          {totalTasks > 0 && (
            <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Issue creation form */}
          {showIssueForm && (
            <form onSubmit={handleCreateIssue} className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquarePlus className="h-4 w-4" />
                Create Issue
              </div>
              <Input
                placeholder="Issue title (e.g., Add user authentication)"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                disabled={creatingIssue}
              />
              <textarea
                placeholder="Describe what needs to be done. Claude will break this down into individual tasks..."
                value={issueBody}
                onChange={(e) => setIssueBody(e.target.value)}
                disabled={creatingIssue}
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowIssueForm(false);
                    setIssueTitle("");
                    setIssueBody("");
                  }}
                  disabled={creatingIssue}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creatingIssue || !issueTitle.trim()}
                >
                  {creatingIssue ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Generating tasks...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Create Issue
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Add single task form */}
          <form onSubmit={handleAddTask} className="flex gap-2">
            <Input
              placeholder="Add a single task..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={addingTask || !newTaskText.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              {addingTask ? "Adding..." : "Add"}
            </Button>
          </form>

          {/* Task list */}
          {project.tasks && project.tasks.length > 0 ? (
            <ul className="space-y-1">
              {project.tasks.map((task, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 py-2 px-2 -mx-2 rounded hover:bg-muted/50 group"
                >
                  <button
                    onClick={() => handleToggleTask(index)}
                    className="shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 hover:text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    )}
                  </button>
                  <span
                    className={`flex-1 ${
                      task.completed ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {task.text}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTask(index)}
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tasks yet. Add one above to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
