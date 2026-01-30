import { readdirSync, existsSync, readFileSync, statSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execFileSync, spawn } from "child_process";
import { getConfigValue } from "./config.js";

export interface TaskItem {
  text: string;
  completed: boolean;
}

export interface ProjectInfo {
  name: string;
  path: string;
  hasGit: boolean;
  githubUrl?: string;
  tasksCompletion?: {
    completed: number;
    total: number;
    percentage: number;
  };
  hasContextMd: boolean;
}

export interface ProjectDetail extends ProjectInfo {
  gitBranch?: string;
  gitStatus?: {
    modified: number;
    untracked: number;
    staged: number;
  };
  tasks?: TaskItem[];
  contextMdContent?: string;
  lastModified?: string;
}

function getProjectsDir(): string {
  return getConfigValue("PROJECTS_DIR") || join(homedir(), "Projects");
}

function getGitRemoteUrl(projectPath: string): string | undefined {
  try {
    const result = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: projectPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();

    // Convert SSH URL to HTTPS URL if needed
    if (result.startsWith("git@github.com:")) {
      return result.replace("git@github.com:", "https://github.com/").replace(/\.git$/, "");
    }
    return result.replace(/\.git$/, "");
  } catch {
    return undefined;
  }
}

function parseTasksCompletion(projectPath: string): ProjectInfo["tasksCompletion"] {
  const tasksPath = join(projectPath, "TASKS.md");
  if (!existsSync(tasksPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(tasksPath, "utf-8");
    const lines = content.split("\n");

    let completed = 0;
    let total = 0;

    for (const line of lines) {
      // Match markdown task items: - [ ] or - [x]
      if (line.match(/^\s*-\s*\[[\sx]\]/i)) {
        total++;
        if (line.match(/^\s*-\s*\[x\]/i)) {
          completed++;
        }
      }
    }

    if (total === 0) {
      return undefined;
    }

    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
    };
  } catch {
    return undefined;
  }
}

export function getProjectInfo(projectPath: string, name: string): ProjectInfo {
  const hasGit = existsSync(join(projectPath, ".git"));
  const hasContextMd = existsSync(join(projectPath, "CONTEXT.md"));

  const info: ProjectInfo = {
    name,
    path: projectPath,
    hasGit,
    hasContextMd,
  };

  if (hasGit) {
    info.githubUrl = getGitRemoteUrl(projectPath);
  }

  const tasksCompletion = parseTasksCompletion(projectPath);
  if (tasksCompletion) {
    info.tasksCompletion = tasksCompletion;
  }

  return info;
}

export function listProjects(): ProjectInfo[] {
  const projectsDir = getProjectsDir();

  if (!existsSync(projectsDir)) {
    return [];
  }

  const entries = readdirSync(projectsDir);
  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    // Skip hidden directories
    if (entry.startsWith(".")) {
      continue;
    }

    const fullPath = join(projectsDir, entry);

    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        projects.push(getProjectInfo(fullPath, entry));
      }
    } catch {
      // Skip entries we can't stat
      continue;
    }
  }

  // Sort by name
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function getGitBranch(projectPath: string): string | undefined {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd: projectPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
  } catch {
    return undefined;
  }
}

function getGitStatus(projectPath: string): ProjectDetail["gitStatus"] {
  try {
    const result = execFileSync("git", ["status", "--porcelain"], {
      cwd: projectPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });

    const lines = result.trim().split("\n").filter(Boolean);
    let modified = 0;
    let untracked = 0;
    let staged = 0;

    for (const line of lines) {
      const status = line.substring(0, 2);
      if (status.includes("?")) {
        untracked++;
      } else if (status[0] !== " " && status[0] !== "?") {
        staged++;
      }
      if (status[1] === "M" || status[1] === "D") {
        modified++;
      }
    }

    return { modified, untracked, staged };
  } catch {
    return undefined;
  }
}

function parseTasks(projectPath: string): TaskItem[] | undefined {
  const tasksPath = join(projectPath, "TASKS.md");
  if (!existsSync(tasksPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(tasksPath, "utf-8");
    const lines = content.split("\n");
    const tasks: TaskItem[] = [];

    for (const line of lines) {
      const match = line.match(/^\s*-\s*\[([\sx])\]\s*(.+)/i);
      if (match) {
        tasks.push({
          completed: match[1].toLowerCase() === "x",
          text: match[2].trim(),
        });
      }
    }

    return tasks.length > 0 ? tasks : undefined;
  } catch {
    return undefined;
  }
}

function getLastModified(projectPath: string): string | undefined {
  try {
    const stat = statSync(projectPath);
    return stat.mtime.toISOString();
  } catch {
    return undefined;
  }
}

export function getProjectDetail(name: string): ProjectDetail | null {
  const projectsDir = getProjectsDir();
  const projectPath = join(projectsDir, name);

  if (!existsSync(projectPath)) {
    return null;
  }

  try {
    const stat = statSync(projectPath);
    if (!stat.isDirectory()) {
      return null;
    }
  } catch {
    return null;
  }

  const basicInfo = getProjectInfo(projectPath, name);
  const detail: ProjectDetail = { ...basicInfo };

  if (basicInfo.hasGit) {
    detail.gitBranch = getGitBranch(projectPath);
    detail.gitStatus = getGitStatus(projectPath);
  }

  detail.tasks = parseTasks(projectPath);
  detail.lastModified = getLastModified(projectPath);

  const contextPath = join(projectPath, "CONTEXT.md");
  if (basicInfo.hasContextMd) {
    try {
      detail.contextMdContent = readFileSync(contextPath, "utf-8");
    } catch {
      // Ignore read errors
    }
  }

  return detail;
}

export function addTask(projectName: string, taskText: string): boolean {
  const projectsDir = getProjectsDir();
  const tasksPath = join(projectsDir, projectName, "TASKS.md");

  try {
    let content = "";
    if (existsSync(tasksPath)) {
      content = readFileSync(tasksPath, "utf-8");
    } else {
      content = "# Tasks\n\n";
    }

    // Add the new task
    const newTask = `- [ ] ${taskText}\n`;

    // If file ends with newline, just append; otherwise add newline first
    if (content.endsWith("\n")) {
      content += newTask;
    } else {
      content += "\n" + newTask;
    }

    writeFileSync(tasksPath, content);
    return true;
  } catch {
    return false;
  }
}

export function toggleTask(projectName: string, taskIndex: number): boolean {
  const projectsDir = getProjectsDir();
  const tasksPath = join(projectsDir, projectName, "TASKS.md");

  if (!existsSync(tasksPath)) {
    return false;
  }

  try {
    const content = readFileSync(tasksPath, "utf-8");
    const lines = content.split("\n");

    let currentTaskIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\s*-\s*\[)([\sx])(\]\s*.+)/i);
      if (match) {
        if (currentTaskIndex === taskIndex) {
          // Toggle the checkbox
          const newStatus = match[2].toLowerCase() === "x" ? " " : "x";
          lines[i] = `${match[1]}${newStatus}${match[3]}`;
          writeFileSync(tasksPath, lines.join("\n"));
          return true;
        }
        currentTaskIndex++;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function deleteTask(projectName: string, taskIndex: number): boolean {
  const projectsDir = getProjectsDir();
  const tasksPath = join(projectsDir, projectName, "TASKS.md");

  if (!existsSync(tasksPath)) {
    return false;
  }

  try {
    const content = readFileSync(tasksPath, "utf-8");
    const lines = content.split("\n");

    let currentTaskIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^\s*-\s*\[[\sx]\]/i)) {
        if (currentTaskIndex === taskIndex) {
          lines.splice(i, 1);
          writeFileSync(tasksPath, lines.join("\n"));
          return true;
        }
        currentTaskIndex++;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function deleteProject(projectName: string): { success: boolean; error?: string } {
  const projectsDir = getProjectsDir();
  const projectPath = join(projectsDir, projectName);

  // Validate project exists
  if (!existsSync(projectPath)) {
    return { success: false, error: "Project not found" };
  }

  // Validate it's a directory
  try {
    const stat = statSync(projectPath);
    if (!stat.isDirectory()) {
      return { success: false, error: "Not a directory" };
    }
  } catch {
    return { success: false, error: "Cannot access project" };
  }

  // Prevent path traversal attacks
  if (projectName.includes("..") || projectName.includes("/") || projectName.includes("\\")) {
    return { success: false, error: "Invalid project name" };
  }

  // Delete the project directory recursively
  try {
    rmSync(projectPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to delete project: ${errorMsg}` };
  }
}

// GitHub URL parsing result
export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  cloneUrl: string;
}

/**
 * Parses various GitHub URL formats and normalizes them.
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - owner/repo (shorthand)
 *
 * @param url - The GitHub URL or shorthand to parse
 * @returns Parsed URL info with owner, repo, and normalized clone URL
 * @throws Error if the URL format is invalid
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  const trimmed = url.trim();

  // Pattern for HTTPS URLs: https://github.com/owner/repo or https://github.com/owner/repo.git
  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/);
  if (httpsMatch) {
    const owner = httpsMatch[1];
    const repo = httpsMatch[2];
    return {
      owner,
      repo,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  // Pattern for SSH URLs: git@github.com:owner/repo.git
  const sshMatch = trimmed.match(/^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = sshMatch[2];
    return {
      owner,
      repo,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  // Pattern for shorthand: owner/repo
  const shorthandMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shorthandMatch) {
    const owner = shorthandMatch[1];
    const repo = shorthandMatch[2];
    return {
      owner,
      repo,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  throw new Error(`Invalid GitHub URL format: ${url}`);
}

// Issue processing jobs
const issueJobs = new Map<string, { status: "running" | "success" | "error"; output: string; tasks?: string[] }>();

export function getIssueJobStatus(jobId: string) {
  return issueJobs.get(jobId);
}

// Dev job tracking per project
interface DevJobStatus {
  status: "idle" | "running" | "success" | "error";
  startedAt?: string;
  log?: string;
  error?: {
    phase: string;
    message: string;
    file?: string;
    line?: number;
    suggestion?: string;
  };
}

function getDevLogPath(projectName: string): string {
  return join(homedir(), ".pauly", "logs", `dev-${projectName}.log`);
}

function parseDevErrors(log: string): DevJobStatus["error"] | undefined {
  // Look for common error patterns and extract actionable info
  const lines = log.split("\n");

  // Check for syntax errors in bash scripts
  const bashError = log.match(/([^:\s]+\.sh): line (\d+): (.+)/);
  if (bashError) {
    return {
      phase: "dev-loop",
      message: bashError[3],
      file: bashError[1],
      line: parseInt(bashError[2]),
      suggestion: `Fix syntax error in ${bashError[1]} at line ${bashError[2]}: ${bashError[3]}`
    };
  }

  // Check for TypeScript/JavaScript errors
  const tsError = log.match(/([^:\s]+\.[tj]sx?):(\d+):(\d+)[:\s]+(.+)/);
  if (tsError) {
    return {
      phase: "execute",
      message: tsError[4],
      file: tsError[1],
      line: parseInt(tsError[2]),
      suggestion: `Fix error in ${tsError[1]} at line ${tsError[2]}: ${tsError[4]}`
    };
  }

  // Check for test failures
  const testFail = log.match(/FAIL\s+(.+\.test\.[tj]sx?)/);
  if (testFail) {
    // Find the actual error message
    const errorMatch = log.match(/Error: (.+?)(?:\n|$)/);
    return {
      phase: "review",
      message: errorMatch ? errorMatch[1] : "Test failed",
      file: testFail[1],
      suggestion: `Fix failing test in ${testFail[1]}: ${errorMatch?.[1] || "check test output"}`
    };
  }

  // Check for Claude/API errors
  const claudeError = log.match(/Error:?\s*(rate limit|session limit|API|timeout)/i);
  if (claudeError) {
    return {
      phase: "api",
      message: claudeError[0],
      suggestion: "Wait and retry - API limit reached"
    };
  }

  // Generic error detection
  const genericError = log.match(/\[?ERROR\]?\s*(.+)/i);
  if (genericError) {
    return {
      phase: "unknown",
      message: genericError[1],
      suggestion: genericError[1]
    };
  }

  // Check for red text (ANSI escape for errors)
  const redText = log.match(/\x1b\[31m(.+?)\x1b/);
  if (redText) {
    return {
      phase: "unknown",
      message: redText[1].replace(/\x1b\[\d+m/g, ""),
      suggestion: redText[1].replace(/\x1b\[\d+m/g, "")
    };
  }

  return undefined;
}

export function getDevJobStatus(projectName: string): DevJobStatus {
  const logPath = getDevLogPath(projectName);
  const projectsDir = getProjectsDir();
  const projectPath = join(projectsDir, projectName);

  // Check if dev process is running for this project
  try {
    const psOutput = execFileSync("pgrep", ["-f", `pauly dev.*${projectPath}`], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();

    if (psOutput) {
      // Process is running - read current log
      let log = "";
      if (existsSync(logPath)) {
        log = readFileSync(logPath, "utf-8");
        // Get last 100 lines for display
        const lines = log.split("\n");
        log = lines.slice(-100).join("\n");
      }

      const error = parseDevErrors(log);
      return {
        status: error ? "error" : "running",
        log,
        error
      };
    }
  } catch {
    // pgrep returns non-zero if no processes found
  }

  // Process not running - check log for final status
  if (!existsSync(logPath)) {
    return { status: "idle" };
  }

  const log = readFileSync(logPath, "utf-8");
  const lines = log.split("\n");
  const lastLines = lines.slice(-100).join("\n");

  // Check for completion
  if (log.includes("All tasks complete!") || log.includes("Development loop complete")) {
    return { status: "success", log: lastLines };
  }

  // Check for errors
  const error = parseDevErrors(log);
  if (error) {
    return { status: "error", log: lastLines, error };
  }

  return { status: "idle", log: lastLines };
}

export function clearDevLog(projectName: string): boolean {
  const logPath = getDevLogPath(projectName);
  if (existsSync(logPath)) {
    try {
      rmSync(logPath);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

export function createIssue(projectName: string, title: string, body: string): string {
  const projectsDir = getProjectsDir();
  const projectPath = join(projectsDir, projectName);
  const tasksPath = join(projectPath, "TASKS.md");

  const jobId = `${projectName}-${Date.now()}`;
  issueJobs.set(jobId, { status: "running", output: "" });

  // Run Claude in background
  const prompt = `Break down this issue into specific tasks. Output ONLY markdown checkboxes.

Issue: ${title}
${body ? `Details: ${body}` : ""}

Output format (no other text):
- [ ] Task 1
- [ ] Task 2`;

  // Use setTimeout to run async
  setTimeout(() => {
    try {
      const output = execFileSync("claude", [
        "--print",
        "--dangerously-skip-permissions",
        "-p",
        prompt
      ], {
        cwd: projectPath,
        encoding: "utf-8",
        timeout: 120000, // 2 minute timeout
        env: { ...process.env, TERM: "dumb" }
      });

      // Parse the tasks from Claude's output
      const taskLines = output.split("\n").filter(line => line.match(/^\s*-\s*\[\s*\]/));
      const tasks = taskLines.map(line => {
        const match = line.match(/^\s*-\s*\[\s*\]\s*(.+)/);
        return match ? match[1].trim() : "";
      }).filter(Boolean);

      if (tasks.length === 0) {
        issueJobs.set(jobId, { status: "error", output: "No tasks generated. Response: " + output });
        return;
      }

      // Append tasks to TASKS.md
      let content = "";
      if (existsSync(tasksPath)) {
        content = readFileSync(tasksPath, "utf-8");
      } else {
        content = "# Tasks\n\n";
      }

      // Add section header for the issue
      const issueSection = `\n## ${title}\n\n${taskLines.join("\n")}\n`;

      if (content.endsWith("\n")) {
        content += issueSection;
      } else {
        content += "\n" + issueSection;
      }

      writeFileSync(tasksPath, content);

      // Spawn pauly dev in background to work on tasks
      const paulyPath = join(homedir(), ".pauly", "pauly");
      const logPath = getDevLogPath(projectName);
      // Clear previous log and start fresh
      if (existsSync(logPath)) {
        rmSync(logPath);
      }
      const cmd = `cd "${projectPath}" && "${paulyPath}" dev >> "${logPath}" 2>&1`;
      spawn("bash", ["-c", cmd], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, TERM: "dumb" }
      }).unref();

      issueJobs.set(jobId, { status: "success", output, tasks });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      issueJobs.set(jobId, { status: "error", output: errorMsg });
    }
  }, 0);

  return jobId;
}
