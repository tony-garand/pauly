import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

const CONFIG_PATH = join(homedir(), ".config", "pauly", "config");

export interface PaulyConfig {
  ADMIN_ALLOWED_IP?: string;
  ADMIN_PORT?: string;
  PROJECTS_DIR?: string;
  [key: string]: string | undefined;
}

export function readPaulyConfig(): PaulyConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

  const content = readFileSync(CONFIG_PATH, "utf-8");
  const config: PaulyConfig = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (match) {
      const [, key, value] = match;
      config[key] = value;
    }
  }

  return config;
}

export function getConfigValue(key: string): string | undefined {
  const config = readPaulyConfig();
  return config[key];
}

export function updateConfigValue(key: string, value: string): void {
  // Ensure config directory exists
  const configDir = dirname(CONFIG_PATH);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Read existing content preserving comments and structure
  let content = "";
  if (existsSync(CONFIG_PATH)) {
    content = readFileSync(CONFIG_PATH, "utf-8");
  }

  const lines = content.split("\n");
  let found = false;
  const keyPattern = new RegExp(`^${key}=`);

  for (let i = 0; i < lines.length; i++) {
    if (keyPattern.test(lines[i])) {
      lines[i] = `${key}="${value}"`;
      found = true;
      break;
    }
  }

  if (!found) {
    // Add new key at end
    if (lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push(`${key}="${value}"`);
  }

  writeFileSync(CONFIG_PATH, lines.join("\n"));
}

export function deleteConfigValue(key: string): boolean {
  if (!existsSync(CONFIG_PATH)) {
    return false;
  }

  const content = readFileSync(CONFIG_PATH, "utf-8");
  const lines = content.split("\n");
  const keyPattern = new RegExp(`^${key}=`);
  const filteredLines = lines.filter((line) => !keyPattern.test(line));

  if (filteredLines.length === lines.length) {
    return false; // Key not found
  }

  writeFileSync(CONFIG_PATH, filteredLines.join("\n"));
  return true;
}
