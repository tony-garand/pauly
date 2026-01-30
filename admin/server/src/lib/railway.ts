import { execFileSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

export interface RailwayStatus {
  authenticated: boolean;
  user?: string;
  error?: string;
}

export interface RailwayService {
  id: string;
  name: string;
}

export interface RailwayProject {
  id: string;
  name: string;
  environments?: string[];
  services?: RailwayService[];
}

export interface RailwayDeployment {
  id: string;
  projectId: string;
  status: string;
  createdAt: string;
}

export interface DeployResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface LinkResult {
  success: boolean;
  message?: string;
  error?: string;
}

function getRailwayPath(): string | null {
  const paths = [
    join(homedir(), ".local", "bin", "railway"),
    "/usr/local/bin/railway",
    join(homedir(), ".railway", "bin", "railway"),
  ];

  for (const p of paths) {
    try {
      execFileSync("test", ["-x", p], { stdio: "ignore" });
      return p;
    } catch {
      continue;
    }
  }

  // Try which
  try {
    return execFileSync("which", ["railway"], { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function execRailway(args: string[], cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  const railwayPath = getRailwayPath();
  if (!railwayPath) {
    return { stdout: "", stderr: "Railway CLI not found", exitCode: 1 };
  }

  try {
    const stdout = execFileSync(railwayPath, args, {
      encoding: "utf-8",
      cwd,
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: stdout.trim(), stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: execError.stdout?.toString() || "",
      stderr: execError.stderr?.toString() || "",
      exitCode: execError.status || 1,
    };
  }
}

// GET /api/railway/status - Get Railway login status
export async function getRailwayStatus(): Promise<RailwayStatus> {
  const result = execRailway(["whoami"]);

  if (result.exitCode !== 0) {
    return {
      authenticated: false,
      error: result.stderr || "Not authenticated",
    };
  }

  return {
    authenticated: true,
    user: result.stdout,
  };
}

// GET /api/railway/projects - List Railway projects
export async function listRailwayProjects(): Promise<RailwayProject[]> {
  const result = execRailway(["list", "--json"]);

  if (result.exitCode !== 0) {
    console.error("Failed to list projects:", result.stderr);
    return [];
  }

  try {
    // Railway list outputs JSON when --json flag is used
    const data = JSON.parse(result.stdout);
    if (!Array.isArray(data)) return [];

    // Parse services from the nested structure
    return data.map((project: Record<string, unknown>) => {
      const services: RailwayService[] = [];
      const servicesData = project.services as { edges?: Array<{ node?: { id?: string; name?: string } }> } | undefined;
      if (servicesData?.edges) {
        for (const edge of servicesData.edges) {
          if (edge.node?.id && edge.node?.name) {
            services.push({ id: edge.node.id, name: edge.node.name });
          }
        }
      }
      return {
        id: project.id as string,
        name: project.name as string,
        services,
      };
    });
  } catch {
    // Fallback: parse text output
    const lines = result.stdout.split("\n").filter((line) => line.trim());
    return lines.map((line, index) => ({
      id: `project-${index}`,
      name: line.trim(),
    }));
  }
}

// GET /api/railway/projects/:id - Get project details
export async function getRailwayProjectDetails(projectId: string): Promise<RailwayProject | null> {
  // Railway doesn't have a direct "get project by ID" command
  // We list projects and filter
  const projects = await listRailwayProjects();
  return projects.find((p) => p.id === projectId || p.name === projectId) || null;
}

// POST /api/railway/projects/:id/deploy - Trigger deployment
export async function deployToRailway(projectPath: string, detach?: boolean): Promise<DeployResult> {
  // Check if project is linked first
  const statusResult = execRailway(["status"], projectPath);
  if (statusResult.exitCode !== 0) {
    const errorMsg = statusResult.stderr || statusResult.stdout || "";
    if (errorMsg.includes("No linked project")) {
      return {
        success: false,
        error: "Project not linked to Railway. Run 'railway link' in the project directory first.",
      };
    }
    return {
      success: false,
      error: errorMsg || "Failed to check Railway status",
    };
  }

  const args = ["up"];
  if (detach) {
    args.push("--detach");
  }

  const result = execRailway(args, projectPath);

  if (result.exitCode !== 0) {
    const errorMsg = result.stderr || result.stdout || "Deployment failed";
    return {
      success: false,
      error: errorMsg,
    };
  }

  return {
    success: true,
    message: result.stdout || "Deployment initiated successfully",
  };
}

// GET /api/railway/projects/:id/logs - Get deployment logs
export async function getRailwayLogs(projectPath: string, lines?: number): Promise<string> {
  const args = ["logs"];
  // Note: Railway logs doesn't support --lines flag, it streams continuously
  // We'll capture what we can

  const result = execRailway(args, projectPath);

  if (result.exitCode !== 0 && !result.stdout) {
    return result.stderr || "Failed to fetch logs";
  }

  const logLines = result.stdout.split("\n");
  if (lines && lines > 0) {
    return logLines.slice(-lines).join("\n");
  }

  return result.stdout;
}

// POST /api/railway/link - Link local project to Railway
// Note: railway link is interactive by default. For non-interactive mode,
// you must provide railwayProjectId and optionally serviceId
export async function linkProjectToRailway(
  projectPath: string,
  railwayProjectId?: string,
  serviceId?: string
): Promise<LinkResult> {
  if (!railwayProjectId) {
    return {
      success: false,
      error: "Railway project ID is required. Run 'railway link' in terminal first, or provide a project ID.",
    };
  }

  const args = ["link", "--project", railwayProjectId];
  if (serviceId) {
    args.push("--service", serviceId);
  }

  const result = execRailway(args, projectPath);

  if (result.exitCode !== 0) {
    const errorMsg = result.stderr || result.stdout || "Failed to link project";
    return {
      success: false,
      error: errorMsg,
    };
  }

  return {
    success: true,
    message: "Project linked successfully",
  };
}

// GET /api/railway/deployments - List recent deployments
export async function listRecentDeployments(): Promise<RailwayDeployment[]> {
  // Railway CLI doesn't have a direct deployments list command
  // This would typically require the Railway API directly
  // For now, return empty array - can be enhanced later with API integration
  const result = execRailway(["status"]);

  if (result.exitCode !== 0) {
    return [];
  }

  // Parse status output for deployment info
  // This is a simplified implementation
  return [];
}
