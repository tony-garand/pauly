import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface CliInfo {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
  isCustom?: boolean;
}

export interface CliEntry {
  name: string;
  versionFlag: string;
}

const DEFAULT_CLI_LIST: CliEntry[] = [
  { name: "node", versionFlag: "--version" },
  { name: "pnpm", versionFlag: "--version" },
  { name: "npm", versionFlag: "--version" },
  { name: "git", versionFlag: "--version" },
  { name: "gh", versionFlag: "--version" },
  { name: "claude", versionFlag: "--version" },
  { name: "docker", versionFlag: "--version" },
  { name: "python", versionFlag: "--version" },
  { name: "python3", versionFlag: "--version" },
  { name: "ruby", versionFlag: "--version" },
  { name: "go", versionFlag: "version" },
  { name: "rustc", versionFlag: "--version" },
  { name: "cargo", versionFlag: "--version" },
  { name: "java", versionFlag: "-version" },
  { name: "deno", versionFlag: "--version" },
  { name: "bun", versionFlag: "--version" },
  { name: "railway", versionFlag: "--version" },
];

const CUSTOM_CLIS_FILE = join(homedir(), ".config", "pauly", "custom-clis.json");

function getCustomClis(): CliEntry[] {
  if (!existsSync(CUSTOM_CLIS_FILE)) {
    return [];
  }
  try {
    const content = readFileSync(CUSTOM_CLIS_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function saveCustomClis(clis: CliEntry[]): void {
  writeFileSync(CUSTOM_CLIS_FILE, JSON.stringify(clis, null, 2));
}

export function addCustomCli(name: string, versionFlag: string = "--version"): boolean {
  const customClis = getCustomClis();
  const allNames = [...DEFAULT_CLI_LIST, ...customClis].map(c => c.name);
  if (allNames.includes(name)) {
    return false; // Already exists
  }
  customClis.push({ name, versionFlag });
  saveCustomClis(customClis);
  return true;
}

export function removeCustomCli(name: string): boolean {
  const customClis = getCustomClis();
  const index = customClis.findIndex(c => c.name === name);
  if (index === -1) {
    return false; // Not found or is a default CLI
  }
  customClis.splice(index, 1);
  saveCustomClis(customClis);
  return true;
}

export function isDefaultCli(name: string): boolean {
  return DEFAULT_CLI_LIST.some(c => c.name === name);
}

function execQuiet(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function getCliPath(name: string): string | null {
  const result = execQuiet("which", [name]);
  return result || null;
}

function getCliVersion(name: string, versionFlag: string): string | null {
  const result = execQuiet(name, [versionFlag]);
  if (!result) return null;

  // Extract version number from various formats
  const versionMatch = result.match(/(\d+\.\d+\.?\d*)/);
  return versionMatch ? versionMatch[1] : result.split("\n")[0];
}

export function detectCli(name: string, versionFlag: string, isCustom: boolean = false): CliInfo {
  const path = getCliPath(name);
  if (!path) {
    return { name, installed: false, isCustom };
  }

  const version = getCliVersion(name, versionFlag);
  return {
    name,
    installed: true,
    version: version || undefined,
    path,
    isCustom,
  };
}

export function detectAllClis(): CliInfo[] {
  const defaultClis = DEFAULT_CLI_LIST.map(({ name, versionFlag }) =>
    detectCli(name, versionFlag, false)
  );
  const customClis = getCustomClis().map(({ name, versionFlag }) =>
    detectCli(name, versionFlag, true)
  );
  return [...defaultClis, ...customClis];
}
