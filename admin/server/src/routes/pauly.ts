import { Router, type Router as RouterType } from "express";
import { getPaulyStatus, getSanitizedConfig, getLogContent, getAvailableLogs } from "../lib/pauly.js";
import { updateConfigValue, deleteConfigValue } from "../lib/config.js";

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

export default router;
