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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Priority: env var > Pauly config > default
const PORT = Number(process.env.PORT || getConfigValue("ADMIN_PORT") || 3001);

app.use(cors());
app.use(express.json());
app.use(ipFilter);

// API routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/clis", clisRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/pauly", paulyRouter);
app.use("/api/railway", railwayRouter);

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
