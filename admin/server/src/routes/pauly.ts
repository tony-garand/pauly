import { Router, type Router as RouterType } from "express";
import { execFileSync, spawn } from "child_process";
import { getPaulyStatus, getSanitizedConfig, getLogContent, getAvailableLogs, PAULY_DIR } from "../lib/pauly.js";
import { updateConfigValue, deleteConfigValue, getConfigValue } from "../lib/config.js";
import { killAllClaudeProcesses } from "../lib/projects.js";
import { getClaudeSessions, killClaudeSession } from "../lib/claude-sessions.js";

const router: RouterType = Router();

router.get("/status", (_req, res) => {
  const status = getPaulyStatus();
  res.json(status);
});

router.get("/config", (_req, res) => {
  const config = getSanitizedConfig();
  res.json({ config });
});

router.patch("/config", (req, res) => {
  const { key, value } = req.body;
  if (!key || typeof key !== "string") {
    res.status(400).json({ error: "Key is required" });
    return;
  }
  if (typeof value !== "string") {
    res.status(400).json({ error: "Value must be a string" });
    return;
  }
  try {
    updateConfigValue(key, value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update config" });
  }
});

router.delete("/config/:key", (req, res) => {
  const { key } = req.params;
  try {
    const deleted = deleteConfigValue(key);
    if (!deleted) {
      res.status(404).json({ error: "Config key not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete config" });
  }
});

router.get("/logs", (_req, res) => {
  const logs = getAvailableLogs();
  res.json({ logs });
});

router.get("/logs/:job", (req, res) => {
  const { job } = req.params;
  const tail = req.query.tail ? parseInt(req.query.tail as string, 10) : undefined;

  const log = getLogContent(job, tail);

  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }

  res.json({ log });
});

// Running Claude sessions
router.get("/sessions", (_req, res) => {
  try {
    const sessions = getClaudeSessions();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to get Claude sessions" });
  }
});

// Kill individual Claude session
router.post("/sessions/:pid/kill", (req, res) => {
  const pid = parseInt(req.params.pid, 10);
  if (isNaN(pid) || pid <= 0) {
    res.status(400).json({ error: "Invalid PID" });
    return;
  }
  const result = killClaudeSession(pid);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

// Killswitch - stop all Claude processes
router.post("/kill", (_req, res) => {
  const result = killAllClaudeProcesses();

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json({ success: true, killed: result.killed });
});

// Git pull - update Pauly from remote
router.post("/git-pull", (_req, res) => {
  try {
    const output = execFileSync("git", ["pull"], {
      cwd: PAULY_DIR,
      encoding: "utf-8",
      timeout: 30000,
    });

    const alreadyUpToDate = output.includes("Already up to date");
    res.json({
      success: true,
      output: output.trim(),
      updated: !alreadyUpToDate
    });
  } catch (err) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: error.stderr || error.message || "Git pull failed"
    });
  }
});

// Create an internal task (GitHub Issue with pauly label)
router.post("/tasks", (req, res) => {
  const { title, body } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Task title is required" });
    return;
  }

  const repo = getConfigValue("GITHUB_TASKS_REPO");
  if (!repo) {
    res.status(500).json({ error: "GITHUB_TASKS_REPO not configured" });
    return;
  }

  const label = getConfigValue("GITHUB_TASKS_LABEL") || "pauly";

  try {
    const args = [
      "issue", "create",
      "-R", repo,
      "--title", title.trim(),
      "--label", label,
    ];

    if (body && typeof body === "string" && body.trim()) {
      args.push("--body", body.trim());
    }

    const output = execFileSync("gh", args, {
      encoding: "utf-8",
      timeout: 15000,
    });

    // gh issue create outputs the issue URL
    const issueUrl = output.trim();
    const issueNumber = issueUrl.match(/\/(\d+)$/)?.[1];

    res.json({
      success: true,
      issueUrl,
      issueNumber: issueNumber ? parseInt(issueNumber, 10) : undefined,
    });
  } catch (err) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: error.stderr || error.message || "Failed to create task",
    });
  }
});

// Claude prompt streaming endpoint
router.post("/claude", (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Resolve claude binary path - needed because the server may run
  // as a background process without ~/.local/bin in PATH
  let claudeBin: string;
  try {
    claudeBin = execFileSync("which", ["claude"], { encoding: "utf-8" }).trim();
  } catch {
    claudeBin = (process.env.HOME || "") + "/.local/bin/claude";
  }

  req.socket.setTimeout(0);

  const claude = spawn(claudeBin, [
    "-p",
    "--dangerously-skip-permissions",
    prompt.trim(),
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, TERM: "dumb" },
  });

  claude.stdout.on("data", (data: Buffer) => {
    const text = data.toString();
    res.write(`data: ${JSON.stringify({ type: "content", text })}\n\n`);
  });

  claude.stderr.on("data", (data: Buffer) => {
    const text = data.toString();
    res.write(`data: ${JSON.stringify({ type: "error", text })}\n\n`);
  });

  claude.on("close", (code) => {
    if (code !== 0 && code !== null) {
      res.write(`data: ${JSON.stringify({ type: "error", text: `Process exited with code ${code}` })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  });

  claude.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  });

  res.on("close", () => {
    if (claude.exitCode === null && !claude.killed) {
      claude.kill();
    }
  });
});

export default router;
