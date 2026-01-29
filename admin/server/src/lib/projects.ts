import { readdirSync, existsSync, readFileSync, statSync, writeFileSync } from "fs";
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

// Issue processing jobs
const issueJobs = new Map<string, { status: "running" | "success" | "error"; output: string; tasks?: string[] }>();

export function getIssueJobStatus(jobId: string) {
  return issueJobs.get(jobId);
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
      issueJobs.set(jobId, { status: "success", output, tasks });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      issueJobs.set(jobId, { status: "error", output: errorMsg });
    }
  }, 0);

  return jobId;
}
