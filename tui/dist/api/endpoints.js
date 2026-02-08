import { fetchApi, postApi, patchApi, deleteApi } from "./client.js";
// Health
export const fetchHealth = () => fetchApi("/health");
// Pauly status
export const fetchPaulyStatus = () => fetchApi("/pauly/status");
// Config
export const fetchConfig = () => fetchApi("/pauly/config");
export const updateConfig = (key, value) => patchApi("/pauly/config", { key, value });
export const deleteConfig = (key) => deleteApi(`/pauly/config/${encodeURIComponent(key)}`);
// Projects
export const fetchProjects = () => fetchApi("/projects");
export const fetchProjectDetail = async (name) => {
    const res = await fetchApi(`/projects/${encodeURIComponent(name)}`);
    return res.project;
};
// Dev controls
export const fetchDevStatus = (name) => fetchApi(`/projects/${encodeURIComponent(name)}/dev`);
export const startDev = (name) => postApi(`/projects/${encodeURIComponent(name)}/dev/start`);
export const stopDev = (name) => postApi(`/projects/${encodeURIComponent(name)}/dev/stop`);
export const restartDev = (name) => postApi(`/projects/${encodeURIComponent(name)}/dev/restart`);
// Tasks
export const addTask = (projectName, text) => postApi(`/projects/${encodeURIComponent(projectName)}/tasks`, { text });
export const toggleTask = (projectName, taskIndex) => patchApi(`/projects/${encodeURIComponent(projectName)}/tasks/${taskIndex}`);
export const deleteTask = (projectName, taskIndex) => deleteApi(`/projects/${encodeURIComponent(projectName)}/tasks/${taskIndex}`);
export const createIssue = (projectName, title, body) => postApi(`/projects/${encodeURIComponent(projectName)}/issues`, { title, body });
// Logs
export const fetchLogs = () => fetchApi("/pauly/logs");
export const fetchLogContent = (job, tail) => {
    const params = tail ? `?tail=${tail}` : "";
    return fetchApi(`/pauly/logs/${encodeURIComponent(job)}${params}`);
};
// Sessions
export const fetchSessions = () => fetchApi("/pauly/sessions");
export const killSession = (pid) => postApi(`/pauly/sessions/${pid}/kill`);
export const killAllProcesses = () => postApi("/pauly/kill");
// Queue
export const fetchQueueStats = () => fetchApi("/queue/stats");
export const fetchQueueJobs = (status, limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    if (status)
        params.set("status", status);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return fetchApi(`/queue/jobs?${params}`);
};
export const cancelJob = (id) => deleteApi(`/queue/jobs/${id}`);
// Dead letter
export const fetchDeadLetterStats = () => fetchApi("/deadletter/stats");
export const fetchDeadLetterTasks = (status) => {
    const params = status ? `?status=${status}` : "";
    return fetchApi(`/deadletter${params}`);
};
export const retryDeadLetter = (id) => postApi(`/deadletter/${id}/retry`);
export const resolveDeadLetter = (id) => postApi(`/deadletter/${id}/resolve`);
export const deleteDeadLetter = (id) => deleteApi(`/deadletter/${id}`);
