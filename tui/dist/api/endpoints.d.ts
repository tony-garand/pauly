import type { PaulyStatus, ProjectInfo, ProjectDetail, DevJobStatus, LogInfo, LogContent, ClaudeSessionsResponse, QueueStats, QueueJob, DeadLetterTask, DeadLetterStats } from "./types.js";
export declare const fetchHealth: () => Promise<{
    status: string;
}>;
export declare const fetchPaulyStatus: () => Promise<PaulyStatus>;
export declare const fetchConfig: () => Promise<{
    config: Record<string, string>;
}>;
export declare const updateConfig: (key: string, value: string) => Promise<{
    success: boolean;
}>;
export declare const deleteConfig: (key: string) => Promise<{
    success: boolean;
}>;
export declare const fetchProjects: () => Promise<{
    projects: ProjectInfo[];
}>;
export declare const fetchProjectDetail: (name: string) => Promise<ProjectDetail>;
export declare const fetchDevStatus: (name: string) => Promise<DevJobStatus>;
export declare const startDev: (name: string) => Promise<{
    success: boolean;
}>;
export declare const stopDev: (name: string) => Promise<{
    success: boolean;
}>;
export declare const restartDev: (name: string) => Promise<{
    success: boolean;
}>;
export declare const addTask: (projectName: string, text: string) => Promise<{
    success: boolean;
}>;
export declare const toggleTask: (projectName: string, taskIndex: number) => Promise<{
    success: boolean;
}>;
export declare const deleteTask: (projectName: string, taskIndex: number) => Promise<{
    success: boolean;
}>;
export declare const createIssue: (projectName: string, title: string, body: string) => Promise<{
    jobId: string;
}>;
export declare const fetchLogs: () => Promise<{
    logs: LogInfo[];
}>;
export declare const fetchLogContent: (job: string, tail?: number) => Promise<{
    log: LogContent;
}>;
export declare const fetchSessions: () => Promise<ClaudeSessionsResponse>;
export declare const killSession: (pid: number) => Promise<{
    success: boolean;
}>;
export declare const killAllProcesses: () => Promise<{
    success: boolean;
    killed: number;
}>;
export declare const fetchQueueStats: () => Promise<QueueStats>;
export declare const fetchQueueJobs: (status?: string, limit?: number, offset?: number) => Promise<{
    jobs: QueueJob[];
    total: number;
}>;
export declare const cancelJob: (id: number) => Promise<{
    success: boolean;
}>;
export declare const fetchDeadLetterStats: () => Promise<DeadLetterStats>;
export declare const fetchDeadLetterTasks: (status?: string) => Promise<{
    tasks: DeadLetterTask[];
}>;
export declare const retryDeadLetter: (id: number) => Promise<{
    success: boolean;
}>;
export declare const resolveDeadLetter: (id: number) => Promise<{
    success: boolean;
}>;
export declare const deleteDeadLetter: (id: number) => Promise<{
    success: boolean;
}>;
