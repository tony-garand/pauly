import { execFileSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

export interface ClaudeProcess {
  pid: number;
  cpu: number;
  mem: number;
  uptime: string;
  mode: "plan" | "execute" | "review" | "fix" | "task" | "unknown";
}

export interface ClaudeProjectGroup {
  project: string;
  path: string;
  processes: ClaudeProcess[];
  totalCpu: number;
  totalMem: number;
}

export interface ClaudeSessionsResponse {
  groups: ClaudeProjectGroup[];
  totalProcesses: number;
}

const HOME = homedir();
const PROJECTS_DIR = join(HOME, "Projects");
const PAULY_DIR = join(HOME, ".pauly");

function detectMode(command: string): ClaudeProcess["mode"] {
  const lower = command.toLowerCase();
  if (lower.includes("plan")) return "plan";
  if (lower.includes("execute")) return "execute";
  if (lower.includes("review")) return "review";
  if (lower.includes("fix")) return "fix";
  if (lower.includes("task")) return "task";
  return "unknown";
}

function mapCwdToProject(cwd: string): { project: string; path: string } {
  if (cwd.startsWith(PROJECTS_DIR + "/")) {
    const relative = cwd.slice(PROJECTS_DIR.length + 1);
    const project = relative.split("/")[0];
    return { project, path: join(PROJECTS_DIR, project) };
  }
  if (cwd.startsWith(PAULY_DIR)) {
    return { project: "pauly", path: PAULY_DIR };
  }
  return { project: "other", path: cwd };
}

function getCwd(pid: number): string | null {
  try {
    const output = execFileSync("/usr/sbin/lsof", ["-a", "-d", "cwd", "-p", String(pid), "-Fn"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    // lsof -Fn outputs lines like "p1234\nn/path/to/dir"
    for (const line of output.split("\n")) {
      if (line.startsWith("n") && line.length > 1) {
        return line.slice(1);
      }
    }
  } catch {
    // Process may have exited
  }
  return null;
}

export function killClaudeSession(pid: number): { success: boolean; error?: string } {
  // Verify the PID is actually a claude process before killing
  try {
    const psOutput = execFileSync("/bin/ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    if (!psOutput.includes("claude")) {
      return { success: false, error: "PID is not a Claude process" };
    }
  } catch {
    return { success: false, error: "Process not found" };
  }

  try {
    process.kill(pid, "SIGTERM");
    return { success: true };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ESRCH") {
      return { success: false, error: "Process not found" };
    }
    return { success: false, error: error.message };
  }
}

export function getClaudeSessions(): ClaudeSessionsResponse {
  // Get all claude PIDs
  let pids: number[];
  try {
    const output = execFileSync("/usr/bin/pgrep", ["-f", "claude"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    pids = output.trim().split("\n").map(Number).filter(Boolean);
  } catch {
    // pgrep returns exit code 1 when no processes found
    return { groups: [], totalProcesses: 0 };
  }

  if (pids.length === 0) {
    return { groups: [], totalProcesses: 0 };
  }

  // Get process stats for all PIDs at once
  const processList: Array<ClaudeProcess & { cwd: string }> = [];
  const ownPid = process.pid;

  for (const pid of pids) {
    if (pid === ownPid) continue;

    try {
      const psOutput = execFileSync("/bin/ps", [
        "-p", String(pid),
        "-o", "pid=,ppid=,%cpu=,%mem=,etime=,command=",
      ], {
        encoding: "utf-8",
        timeout: 5000,
      });

      const line = psOutput.trim();
      if (!line) continue;

      // Parse ps output: pid ppid %cpu %mem elapsed command...
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
      if (!match) continue;

      const command = match[6];
      // Only include actual claude processes (not grep, not this server, etc.)
      if (!command.includes("claude") || command.includes("pgrep") || command.includes("grep")) continue;

      const cwd = getCwd(pid);
      if (!cwd) continue;

      processList.push({
        pid,
        cpu: parseFloat(match[3]),
        mem: parseFloat(match[4]),
        uptime: match[5],
        mode: detectMode(command),
        cwd,
      });
    } catch {
      // Process may have exited between pgrep and ps
    }
  }

  // Group by project
  const groupMap = new Map<string, ClaudeProjectGroup>();

  for (const proc of processList) {
    const { project, path } = mapCwdToProject(proc.cwd);
    let group = groupMap.get(project);
    if (!group) {
      group = { project, path, processes: [], totalCpu: 0, totalMem: 0 };
      groupMap.set(project, group);
    }
    group.processes.push({
      pid: proc.pid,
      cpu: proc.cpu,
      mem: proc.mem,
      uptime: proc.uptime,
      mode: proc.mode,
    });
    group.totalCpu += proc.cpu;
    group.totalMem += proc.mem;
  }

  // Round totals
  for (const group of groupMap.values()) {
    group.totalCpu = Math.round(group.totalCpu * 10) / 10;
    group.totalMem = Math.round(group.totalMem * 10) / 10;
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => a.project.localeCompare(b.project));

  return {
    groups,
    totalProcesses: processList.length,
  };
}
