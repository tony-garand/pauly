import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket } from "lucide-react";
import type { RailwayDeployment as RailwayDeploymentType } from "@/lib/api";

interface RailwayDeploymentProps {
  deployments: RailwayDeploymentType[];
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" {
  switch (status.toUpperCase()) {
    case "SUCCESS":
      return "default";
    case "BUILDING":
    case "DEPLOYING":
    case "INITIALIZING":
      return "secondary";
    case "FAILED":
    case "CRASHED":
    case "REMOVED":
      return "destructive";
    default:
      return "secondary";
  }
}

function getStatusClassName(status: string): string {
  if (status.toUpperCase() === "SUCCESS") {
    return "bg-green-500 hover:bg-green-600";
  }
  return "";
}

export function RailwayDeployment({ deployments }: RailwayDeploymentProps) {
  if (deployments.length === 0) {
    return null;
  }

  return (
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
                variant={getStatusVariant(deployment.status)}
                className={getStatusClassName(deployment.status)}
              >
                {deployment.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
