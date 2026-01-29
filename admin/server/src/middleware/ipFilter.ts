import type { Request, Response, NextFunction } from "express";
import { getConfigValue } from "../lib/config.js";

function getClientIp(req: Request): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(",")[0].trim();
  }

  // Direct connection IP
  return req.socket.remoteAddress || "unknown";
}

function normalizeIp(ip: string): string {
  // Handle IPv4-mapped IPv6 addresses (::ffff:127.0.0.1 -> 127.0.0.1)
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  // Handle localhost variations
  if (ip === "::1") {
    return "127.0.0.1";
  }
  return ip;
}

export function ipFilter(req: Request, res: Response, next: NextFunction): void {
  const allowedIp = getConfigValue("ADMIN_ALLOWED_IP");

  // If no IP restriction configured, allow all (for development)
  if (!allowedIp) {
    next();
    return;
  }

  const clientIp = normalizeIp(getClientIp(req));
  const allowedIps = allowedIp.split(",").map((ip) => ip.trim());

  // Always allow localhost
  if (clientIp === "127.0.0.1" || clientIp === "localhost") {
    next();
    return;
  }

  if (allowedIps.includes(clientIp)) {
    next();
    return;
  }

  console.warn(`Blocked request from unauthorized IP: ${clientIp}`);
  res.status(403).json({ error: "Forbidden: IP not allowed" });
}
