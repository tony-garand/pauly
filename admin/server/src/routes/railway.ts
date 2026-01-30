import { Router, type Router as RouterType } from "express";
import {
  getRailwayStatus,
  listRailwayProjects,
  getRailwayProjectDetails,
  deployToRailway,
  getRailwayLogs,
  linkProjectToRailway,
  listRecentDeployments,
} from "../lib/railway.js";

const router: RouterType = Router();

// GET /api/railway/status - Get Railway login status
router.get("/status", async (_req, res) => {
  try {
    const status = await getRailwayStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get Railway status" });
  }
});

// GET /api/railway/projects - List Railway projects
router.get("/projects", async (_req, res) => {
  try {
    const projects = await listRailwayProjects();
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: "Failed to list Railway projects" });
  }
});

// GET /api/railway/projects/:id - Get project details
router.get("/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getRailwayProjectDetails(id);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: "Failed to get project details" });
  }
});

// POST /api/railway/projects/:id/deploy - Trigger deployment
// Requires projectPath in body (the local directory linked to Railway)
router.post("/projects/:id/deploy", async (req, res) => {
  try {
    const { detach, projectPath } = req.body;

    if (!projectPath) {
      res.status(400).json({ error: "projectPath is required. Deploy from a project page or provide the local project path." });
      return;
    }

    const result = await deployToRailway(projectPath, detach);

    if (!result.success) {
      res.status(500).json({ error: result.error || "Deployment failed" });
      return;
    }

    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(500).json({ error: "Failed to trigger deployment" });
  }
});

// GET /api/railway/projects/:id/logs - Get deployment logs
// Requires projectPath query param (the local directory linked to Railway)
router.get("/projects/:id/logs", async (req, res) => {
  try {
    const { lines, projectPath } = req.query;

    if (!projectPath || typeof projectPath !== "string") {
      res.status(400).json({ error: "projectPath query param is required" });
      return;
    }

    const logs = await getRailwayLogs(projectPath, lines ? parseInt(lines as string, 10) : undefined);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: "Failed to get deployment logs" });
  }
});

// POST /api/railway/link - Link local project to Railway
router.post("/link", async (req, res) => {
  try {
    const { projectPath, railwayProjectId, serviceId } = req.body;

    if (!projectPath) {
      res.status(400).json({ error: "Project path is required" });
      return;
    }

    const result = await linkProjectToRailway(projectPath, railwayProjectId, serviceId);

    if (!result.success) {
      res.status(500).json({ error: result.error || "Failed to link project" });
      return;
    }

    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(500).json({ error: "Failed to link project to Railway" });
  }
});

// GET /api/railway/deployments - List recent deployments
router.get("/deployments", async (_req, res) => {
  try {
    const deployments = await listRecentDeployments();
    res.json({ deployments });
  } catch (error) {
    res.status(500).json({ error: "Failed to list deployments" });
  }
});

export default router;
