import { Router, type Router as RouterType } from "express";
import { spawn } from "child_process";
import { detectAllClis, addCustomCli, removeCustomCli, isDefaultCli } from "../lib/clis.js";

const router: RouterType = Router();

// Track installation jobs
const installJobs = new Map<string, { status: "running" | "success" | "error"; output: string }>();

router.get("/", (_req, res) => {
  const clis = detectAllClis();
  res.json({ clis });
});

router.post("/", (req, res) => {
  const { name, versionFlag } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const success = addCustomCli(name.trim(), versionFlag?.trim() || "--version");
  if (!success) {
    res.status(409).json({ error: "CLI already exists" });
    return;
  }
  res.status(201).json({ success: true });
});

router.delete("/:name", (req, res) => {
  const { name } = req.params;
  if (isDefaultCli(name)) {
    res.status(400).json({ error: "Cannot remove default CLI" });
    return;
  }
  const success = removeCustomCli(name);
  if (!success) {
    res.status(404).json({ error: "CLI not found" });
    return;
  }
  res.json({ success: true });
});

router.post("/:name/install", (req, res) => {
  const { name } = req.params;

  // Check if already installing
  const existing = installJobs.get(name);
  if (existing?.status === "running") {
    res.status(409).json({ error: "Installation already in progress" });
    return;
  }

  // Start installation with Claude
  installJobs.set(name, { status: "running", output: "" });

  const claude = spawn("claude", [
    "--print",
    "--dangerously-skip-permissions",
    `Install the CLI tool "${name}" on this macOS system. Use brew if available. Be concise.`
  ], {
    shell: true,
    env: { ...process.env, TERM: "dumb" }
  });

  let output = "";

  claude.stdout.on("data", (data) => {
    output += data.toString();
    installJobs.set(name, { status: "running", output });
  });

  claude.stderr.on("data", (data) => {
    output += data.toString();
    installJobs.set(name, { status: "running", output });
  });

  claude.on("close", (code) => {
    installJobs.set(name, {
      status: code === 0 ? "success" : "error",
      output
    });
  });

  claude.on("error", (err) => {
    installJobs.set(name, { status: "error", output: err.message });
  });

  res.json({ success: true, message: "Installation started" });
});

router.get("/:name/install", (req, res) => {
  const { name } = req.params;
  const job = installJobs.get(name);
  if (!job) {
    res.status(404).json({ error: "No installation job found" });
    return;
  }
  res.json(job);
});

export default router;
