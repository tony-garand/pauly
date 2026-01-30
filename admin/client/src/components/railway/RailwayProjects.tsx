import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Train,
  Rocket,
  ScrollText,
  Loader2,
} from "lucide-react";
import type { RailwayProject } from "@/lib/api";

interface RailwayProjectsProps {
  projects: RailwayProject[];
  onDeploy?: (projectId: string) => void;
  onViewLogs?: (projectId: string) => void;
  deploying?: string | null;
  loadingLogs?: string | null;
}

export function RailwayProjects({
  projects,
  onDeploy,
  onViewLogs,
  deploying,
  loadingLogs,
}: RailwayProjectsProps) {
  return (
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
                  {onViewLogs && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewLogs(project.id)}
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
                  )}
                  {onDeploy && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onDeploy(project.id)}
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
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
