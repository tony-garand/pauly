import { Router, type Router as RouterType } from "express";
import { listProjects, getProjectDetail, addTask, toggleTask, deleteTask, createIssue, getIssueJobStatus } from "../lib/projects.js";

const router: RouterType = Router();

router.get("/", (_req, res) => {
  const projects = listProjects();
  res.json({ projects });
});

router.get("/:name", (req, res) => {
  const { name } = req.params;
  const project = getProjectDetail(name);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ project });
});

// Add a new task
router.post("/:name/tasks", (req, res) => {
  const { name } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Task text is required" });
    return;
  }

  const success = addTask(name, text.trim());
  if (!success) {
    res.status(500).json({ error: "Failed to add task" });
    return;
  }

  res.status(201).json({ success: true });
});

// Toggle task completion
router.patch("/:name/tasks/:index", (req, res) => {
  const { name, index } = req.params;
  const taskIndex = parseInt(index, 10);

  if (isNaN(taskIndex) || taskIndex < 0) {
    res.status(400).json({ error: "Invalid task index" });
    return;
  }

  const success = toggleTask(name, taskIndex);
  if (!success) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({ success: true });
});

// Delete a task
router.delete("/:name/tasks/:index", (req, res) => {
  const { name, index } = req.params;
  const taskIndex = parseInt(index, 10);

  if (isNaN(taskIndex) || taskIndex < 0) {
    res.status(400).json({ error: "Invalid task index" });
    return;
  }

  const success = deleteTask(name, taskIndex);
  if (!success) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({ success: true });
});

// Create an issue (generates tasks via Claude)
router.post("/:name/issues", (req, res) => {
  const { name } = req.params;
  const { title, body } = req.body;

  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "Issue title is required" });
    return;
  }

  const jobId = createIssue(name, title.trim(), (body || "").trim());
  res.status(202).json({ jobId });
});

// Get issue job status
router.get("/:name/issues/:jobId", (req, res) => {
  const { jobId } = req.params;
  const status = getIssueJobStatus(jobId);

  if (!status) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(status);
});

export default router;
