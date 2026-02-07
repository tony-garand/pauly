import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { ipFilter } from "./middleware/ipFilter.js";
import { getConfigValue } from "./lib/config.js";
import clisRouter from "./routes/clis.js";
import projectsRouter from "./routes/projects.js";
import paulyRouter from "./routes/pauly.js";
import railwayRouter from "./routes/railway.js";
import deadletterRouter from "./routes/deadletter.js";
import metricsRouter from "./routes/metrics.js";
import queueRouter from "./routes/queue.js";
import docsRouter from "./routes/docs.js";
import dashboardRouter from "./routes/dashboard.js";
import { initDatabase, getDatabaseStats, isDatabaseInitialized } from "./lib/db.js";
import { getDeadLetterStats } from "./lib/deadletter.js";
import { getMetricsSummary } from "./lib/metrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Priority: env var > Pauly config > default
const PORT = Number(process.env.PORT || getConfigValue("ADMIN_PORT") || 3001);

app.use(cors());
app.use(express.json());
app.use(ipFilter);

// API routes
/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Returns server health status including database, dead letter queue, and metrics
 *     responses:
 *       200:
 *         description: Server health information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 */
app.get("/api/health", (_req, res) => {
  const health: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // Add database status if initialized
  if (isDatabaseInitialized()) {
    try {
      const dbStats = getDatabaseStats();
      const dlqStats = getDeadLetterStats();
      const metricsData = getMetricsSummary(1); // Last 24 hours

      health.database = {
        status: "connected",
        size: dbStats.size,
        tables: dbStats.tables.length,
      };

      health.deadLetterQueue = {
        pending: dlqStats.pending,
        abandoned: dlqStats.abandoned,
        total: dlqStats.total,
      };

      health.metrics = {
        last24h: {
          total: metricsData.totalTasks,
          successRate: Math.round(metricsData.successRate * 100) / 100,
        },
      };
    } catch (err) {
      health.database = { status: "error", error: String(err) };
    }
  } else {
    health.database = { status: "not_initialized" };
  }

  res.json(health);
});

// Initialize database
try {
  initDatabase();
  console.log("Database initialized");
} catch (err) {
  console.warn("Database initialization skipped (better-sqlite3 may not be installed):", err);
}

app.use("/api/clis", clisRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/pauly", paulyRouter);
app.use("/api/railway", railwayRouter);
app.use("/api/deadletter", deadletterRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/queue", queueRouter);
app.use("/api/docs", docsRouter);
app.use("/api/dashboard", dashboardRouter);

// Serve static frontend files
const clientDistPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  const allowedIp = getConfigValue("ADMIN_ALLOWED_IP");
  console.log(`Pauly Admin Server running on port ${PORT}`);
  if (allowedIp) {
    console.log(`IP filter enabled: ${allowedIp}`);
  } else {
    console.log("IP filter disabled (no ADMIN_ALLOWED_IP configured)");
  }
});
