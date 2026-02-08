export interface DevStatus {
    status: "idle" | "running" | "success" | "error";
    hasError?: boolean;
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
    devStatus?: DevStatus;
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
    hasTodoMd?: boolean;
    todoMdContent?: string;
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
export interface DevError {
    phase: string;
    message: string;
    file?: string;
    line?: number;
    suggestion?: string;
}
export interface DevJobStatus {
    status: "idle" | "running" | "success" | "error";
    startedAt?: string;
    log?: string;
    iteration?: {
        current: number;
        max: number;
    };
    error?: DevError;
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
export interface ClaudeProcess {
    pid: number;
    cpu: number;
    mem: number;
    uptime: string;
    mode: "plan" | "execute" | "review" | "fix" | "task" | "unknown";
}
export interface ClaudeProjectGroup {
    project: string;
    path: string;
    processes: ClaudeProcess[];
    totalCpu: number;
    totalMem: number;
}
export interface ClaudeSessionsResponse {
    groups: ClaudeProjectGroup[];
    totalProcesses: number;
}
export interface QueueStats {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
}
export interface QueueJob {
    id: number;
    taskType: string;
    status: "pending" | "running" | "completed" | "failed";
    priority: number;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    workerId?: string;
    errorMessage?: string;
    retryCount: number;
    taskData?: Record<string, unknown>;
}
export interface DeadLetterTask {
    id: number;
    originalJobId: number;
    taskType: string;
    errorMessage: string;
    status: "pending" | "retrying" | "resolved" | "abandoned";
    retryCount: number;
    createdAt: string;
    lastRetryAt?: string;
    resolvedAt?: string;
    taskData?: Record<string, unknown>;
}
export interface DeadLetterStats {
    pending: number;
    retrying: number;
    resolved: number;
    abandoned: number;
    total: number;
}
