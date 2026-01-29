const API_BASE = "/api";

export async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

// Types matching server responses
export interface CliInfo {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
  isCustom?: boolean;
}

export interface ProjectInfo {
  name: string;
  path: string;
  hasGit: boolean;
  githubUrl?: string;
  tasksCompletion?: {
    completed: number;
    total: number;
    percentage: number;
  };
  hasContextMd: boolean;
}

export interface TaskItem {
  text: string;
  completed: boolean;
}

export interface ProjectDetail extends ProjectInfo {
  gitBranch?: string;
  gitStatus?: {
    modified: number;
    untracked: number;
    staged: number;
  };
  tasks?: TaskItem[];
  contextMdContent?: string;
  lastModified?: string;
}

export interface PaulyJob {
  name: string;
  schedule: string;
  command: string;
  logFile?: string;
}

export interface PaulyStatus {
  jobs: PaulyJob[];
  paulyDir: string;
  logsDir: string;
}

// API functions
export async function fetchHealth() {
  return fetchApi<{ status: string }>("/health");
}

export async function fetchClis() {
  return fetchApi<{ clis: CliInfo[] }>("/clis");
}

export async function addCli(name: string, versionFlag?: string) {
  const response = await fetch(`${API_BASE}/clis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, versionFlag }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json();
}

export async function removeCli(name: string) {
  const response = await fetch(`${API_BASE}/clis/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json();
}

export async function installCli(name: string) {
  const response = await fetch(`${API_BASE}/clis/${encodeURIComponent(name)}/install`, {
    method: "POST",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json();
}

export interface InstallStatus {
  status: "running" | "success" | "error";
  output: string;
}

export async function getInstallStatus(name: string) {
  return fetchApi<InstallStatus>(`/clis/${encodeURIComponent(name)}/install`);
}

export async function fetchProjects() {
  return fetchApi<{ projects: ProjectInfo[] }>("/projects");
}

export async function fetchPaulyStatus() {
  return fetchApi<PaulyStatus>("/pauly/status");
}

export async function fetchPaulyConfig() {
  return fetchApi<{ config: Record<string, string> }>("/pauly/config");
}

export async function updatePaulyConfig(key: string, value: string) {
  const response = await fetch(`${API_BASE}/pauly/config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json();
}

export async function deletePaulyConfig(key: string) {
  const response = await fetch(`${API_BASE}/pauly/config/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json();
}

export async function fetchProjectDetail(name: string) {
  const res = await fetchApi<{ project: ProjectDetail }>(`/projects/${encodeURIComponent(name)}`);
  return res.project;
}

export async function addProjectTask(projectName: string, text: string) {
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json();
}

export async function toggleProjectTask(projectName: string, taskIndex: number) {
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/tasks/${taskIndex}`, {
    method: "PATCH",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json();
}

export async function deleteProjectTask(projectName: string, taskIndex: number) {
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/tasks/${taskIndex}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json();
}

export async function createProjectIssue(projectName: string, title: string, body: string) {
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectName)}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return response.json() as Promise<{ jobId: string }>;
}

export interface IssueJobStatus {
  status: "running" | "success" | "error";
  output: string;
  tasks?: string[];
}

export async function getIssueJobStatus(projectName: string, jobId: string) {
  return fetchApi<IssueJobStatus>(`/projects/${encodeURIComponent(projectName)}/issues/${encodeURIComponent(jobId)}`);
}

export interface LogInfo {
  name: string;
  path: string;
  size: number;
  lastModified: string;
}

export interface LogContent {
  name: string;
  path: string;
  content: string;
  size: number;
  lastModified: string;
}

export async function fetchAvailableLogs() {
  return fetchApi<{ logs: LogInfo[] }>("/pauly/logs");
}

export async function fetchLogContent(job: string, tail?: number) {
  const params = tail ? `?tail=${tail}` : "";
  return fetchApi<{ log: LogContent }>(`/pauly/logs/${encodeURIComponent(job)}${params}`);
}
