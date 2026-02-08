import { fetchApi, postApi, patchApi, deleteApi } from "./client.js";
import type {
  PaulyStatus,
  ProjectInfo,
  ProjectDetail,
  DevJobStatus,
  LogInfo,
  LogContent,
  ClaudeSessionsResponse,
  QueueStats,
  QueueJob,
  DeadLetterTask,
  DeadLetterStats,
} from "./types.js";

// Health
export const fetchHealth = () =>
  fetchApi<{ status: string }>("/health");

// Pauly status
export const fetchPaulyStatus = () =>
  fetchApi<PaulyStatus>("/pauly/status");

// Config
export const fetchConfig = () =>
  fetchApi<{ config: Record<string, string> }>("/pauly/config");

export const updateConfig = (key: string, value: string) =>
  patchApi<{ success: boolean }>("/pauly/config", { key, value });

export const deleteConfig = (key: string) =>
  deleteApi<{ success: boolean }>(`/pauly/config/${encodeURIComponent(key)}`);

// Projects
export const fetchProjects = () =>
  fetchApi<{ projects: ProjectInfo[] }>("/projects");

export const fetchProjectDetail = async (name: string) => {
  const res = await fetchApi<{ project: ProjectDetail }>(
    `/projects/${encodeURIComponent(name)}`,
  );
  return res.project;
};

// Dev controls
export const fetchDevStatus = (name: string) =>
  fetchApi<DevJobStatus>(`/projects/${encodeURIComponent(name)}/dev`);

export const startDev = (name: string) =>
  postApi<{ success: boolean }>(
    `/projects/${encodeURIComponent(name)}/dev/start`,
  );

export const stopDev = (name: string) =>
  postApi<{ success: boolean }>(
    `/projects/${encodeURIComponent(name)}/dev/stop`,
  );

export const restartDev = (name: string) =>
  postApi<{ success: boolean }>(
    `/projects/${encodeURIComponent(name)}/dev/restart`,
  );

// Tasks
export const addTask = (projectName: string, text: string) =>
  postApi<{ success: boolean }>(
    `/projects/${encodeURIComponent(projectName)}/tasks`,
    { text },
  );

export const toggleTask = (projectName: string, taskIndex: number) =>
  patchApi<{ success: boolean }>(
    `/projects/${encodeURIComponent(projectName)}/tasks/${taskIndex}`,
  );

export const deleteTask = (projectName: string, taskIndex: number) =>
  deleteApi<{ success: boolean }>(
    `/projects/${encodeURIComponent(projectName)}/tasks/${taskIndex}`,
  );

export const createIssue = (
  projectName: string,
  title: string,
  body: string,
) =>
  postApi<{ jobId: string }>(
    `/projects/${encodeURIComponent(projectName)}/issues`,
    { title, body },
  );

// Logs
export const fetchLogs = () =>
  fetchApi<{ logs: LogInfo[] }>("/pauly/logs");

export const fetchLogContent = (job: string, tail?: number) => {
  const params = tail ? `?tail=${tail}` : "";
  return fetchApi<{ log: LogContent }>(
    `/pauly/logs/${encodeURIComponent(job)}${params}`,
  );
};

// Sessions
export const fetchSessions = () =>
  fetchApi<ClaudeSessionsResponse>("/pauly/sessions");

export const killSession = (pid: number) =>
  postApi<{ success: boolean }>(`/pauly/sessions/${pid}/kill`);

export const killAllProcesses = () =>
  postApi<{ success: boolean; killed: number }>("/pauly/kill");

// Queue
export const fetchQueueStats = () =>
  fetchApi<QueueStats>("/queue/stats");

export const fetchQueueJobs = (
  status?: string,
  limit = 50,
  offset = 0,
) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return fetchApi<{ jobs: QueueJob[]; total: number }>(
    `/queue/jobs?${params}`,
  );
};

export const cancelJob = (id: number) =>
  deleteApi<{ success: boolean }>(`/queue/jobs/${id}`);

// Dead letter
export const fetchDeadLetterStats = () =>
  fetchApi<DeadLetterStats>("/deadletter/stats");

export const fetchDeadLetterTasks = (status?: string) => {
  const params = status ? `?status=${status}` : "";
  return fetchApi<{ tasks: DeadLetterTask[] }>(`/deadletter${params}`);
};

export const retryDeadLetter = (id: number) =>
  postApi<{ success: boolean }>(`/deadletter/${id}/retry`);

export const resolveDeadLetter = (id: number) =>
  postApi<{ success: boolean }>(`/deadletter/${id}/resolve`);

export const deleteDeadLetter = (id: number) =>
  deleteApi<{ success: boolean }>(`/deadletter/${id}`);
