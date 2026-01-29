import { execFileSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface PaulyJob {
  name: string;
  schedule: string;
  command: string;
  logFile?: string;
  description?: string;
}

export interface PaulyStatus {
  jobs: PaulyJob[];
  paulyDir: string;
  logsDir: string;
}

function parseCronSchedule(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return schedule;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (minute.startsWith("*/")) {
    const interval = minute.slice(2);
    return `Every ${interval} minutes`;
  }
  if (minute === "0" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const hourNum = parseInt(hour, 10);
    const ampm = hourNum >= 12 ? "PM" : "AM";
    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `Daily at ${hour12}:00 ${ampm}`;
  }
  if (dayOfWeek !== "*" && dayOfMonth === "*") {
    return `Weekly on day ${dayOfWeek} at ${hour}:${minute.padStart(2, "0")}`;
  }

  return schedule;
}

export function getPaulyStatus(): PaulyStatus {
  const paulyDir = join(homedir(), ".pauly");
  const logsDir = join(paulyDir, "logs");
  const jobs: PaulyJob[] = [];

  try {
    const crontab = execFileSync("crontab", ["-l"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });

    for (const line of crontab.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Match pauly jobs (marked with # pauly-job:name)
      const jobMatch = trimmed.match(/^(.+?)\s+(.+?)\s+#\s*pauly-job:(\S+)(?:\s+(.*))?$/);
      if (jobMatch) {
        const [, schedulePart, commandPart, jobName, description] = jobMatch;

        // Extract schedule (first 5 parts) and command
        const parts = (schedulePart + " " + commandPart).split(/\s+/);
        const schedule = parts.slice(0, 5).join(" ");
        const command = parts.slice(5).join(" ").replace(/\s*>>.*$/, "").trim();

        // Try to extract log file
        const logMatch = trimmed.match(/>>\s*(\S+)/);
        const logFile = logMatch ? logMatch[1] : undefined;

        jobs.push({
          name: jobName,
          schedule: parseCronSchedule(schedule),
          command,
          logFile,
          description: description?.trim(),
        });
      }
    }
  } catch {
    // No crontab or error reading it
  }

  return {
    jobs,
    paulyDir,
    logsDir,
  };
}

export interface LogInfo {
  name: string;
  path: string;
  size: number;
  lastModified: string;
}

export interface LogContent {
  name: string;
  path: string;
  content: string;
  size: number;
  lastModified: string;
}

// Map job names to their log files
const JOB_LOG_MAP: Record<string, string> = {
  tasks: "github-tasks.log",
  git: "git-health-check.log",
  summary: "daily-summary.log",
  cron: "cron.log",
  email: "email-tasks.log",
  background: "background.log",
  research: "project-research.log",
};

export function getAvailableLogs(): LogInfo[] {
  const logsDir = join(homedir(), ".pauly", "logs");
  const logs: LogInfo[] = [];

  if (!existsSync(logsDir)) {
    return logs;
  }

  try {
    const entries = readdirSync(logsDir);

    for (const entry of entries) {
      if (!entry.endsWith(".log")) continue;

      const logPath = join(logsDir, entry);
      try {
        const stat = statSync(logPath);
        if (stat.isFile()) {
          logs.push({
            name: entry.replace(".log", ""),
            path: logPath,
            size: stat.size,
            lastModified: stat.mtime.toISOString(),
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Error reading directory
  }

  return logs.sort((a, b) => a.name.localeCompare(b.name));
}

export function getLogContent(jobOrLogName: string, tail?: number): LogContent | null {
  const logsDir = join(homedir(), ".pauly", "logs");

  // Try to resolve job name to log file, or use directly as log name
  const logFileName = JOB_LOG_MAP[jobOrLogName] || `${jobOrLogName}.log`;
  const logPath = join(logsDir, logFileName);

  if (!existsSync(logPath)) {
    return null;
  }

  try {
    const stat = statSync(logPath);
    let content = readFileSync(logPath, "utf-8");

    // Optionally return only the last N lines
    if (tail && tail > 0) {
      const lines = content.split("\n");
      content = lines.slice(-tail).join("\n");
    }

    return {
      name: jobOrLogName,
      path: logPath,
      content,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

// Keys that contain sensitive information and should be redacted
const SENSITIVE_KEYS = [
  "PASSWORD",
  "SECRET",
  "TOKEN",
  "API_KEY",
  "APIKEY",
  "PRIVATE_KEY",
  "CREDENTIALS",
];

function isSensitiveKey(key: string): boolean {
  const upperKey = key.toUpperCase();
  return SENSITIVE_KEYS.some((sensitive) => upperKey.includes(sensitive));
}

export interface SanitizedConfig {
  [key: string]: string;
}

export function getSanitizedConfig(): SanitizedConfig {
  const configPath = join(homedir(), ".config", "pauly", "config");

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config: SanitizedConfig = {};

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
      if (match) {
        const [, key, value] = match;
        // Redact sensitive values
        if (isSensitiveKey(key)) {
          config[key] = "[REDACTED]";
        } else {
          config[key] = value;
        }
      }
    }

    return config;
  } catch {
    return {};
  }
}
