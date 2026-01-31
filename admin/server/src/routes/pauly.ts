import { Router, type Router as RouterType } from "express";
import { execFileSync } from "child_process";
import { getPaulyStatus, getSanitizedConfig, getLogContent, getAvailableLogs, PAULY_DIR } from "../lib/pauly.js";
import { updateConfigValue, deleteConfigValue } from "../lib/config.js";
import { killAllClaudeProcesses } from "../lib/projects.js";

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

export default router;
