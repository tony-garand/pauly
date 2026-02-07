import { getDb } from './db.js';
import { recordTaskMetric } from './metrics.js';
import { addFailedTask } from './deadletter.js';

export interface Job {
  id: number;
  task_type: string;
  task_data: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  worker_id: string | null;
  blocked_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface EnqueueOptions {
  priority?: number;
  blockedBy?: number[];
  taskData?: Record<string, unknown>;
}

export interface DequeueResult {
  job: Job | null;
  acquired: boolean;
}

/**
 * Enqueue a new job
 */
export function enqueueJob(
  taskType: string,
  options: EnqueueOptions = {}
): number {
  const db = getDb();
  const { priority = 0, blockedBy = [], taskData = {} } = options;

  const blockedByStr = blockedBy.length > 0 ? JSON.stringify(blockedBy) : null;
  const taskDataStr = JSON.stringify(taskData);

  const result = db.prepare(`
    INSERT INTO jobs (task_type, task_data, priority, blocked_by)
    VALUES (?, ?, ?, ?)
  `).run(taskType, taskDataStr, priority, blockedByStr);

  return result.lastInsertRowid as number;
}

/**
 * Atomically dequeue the next available job for a worker
 * Uses a transaction to ensure only one worker gets the job
 */
export function dequeueJob(workerId: string): DequeueResult {
  const db = getDb();

  // Use a transaction for atomic dequeue
  const result = db.transaction(() => {
    // Find the next available job (pending, not blocked, highest priority first)
    const job = db.prepare(`
      SELECT * FROM jobs
      WHERE status = 'pending'
        AND (blocked_by IS NULL OR NOT EXISTS (
          SELECT 1 FROM jobs j2
          WHERE j2.id IN (SELECT value FROM json_each(jobs.blocked_by))
            AND j2.status != 'completed'
        ))
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `).get() as Job | undefined;

    if (!job) {
      return { job: null, acquired: false };
    }

    // Atomically claim the job
    const updateResult = db.prepare(`
      UPDATE jobs
      SET status = 'running', worker_id = ?, started_at = datetime('now')
      WHERE id = ? AND status = 'pending'
    `).run(workerId, job.id);

    if (updateResult.changes === 0) {
      // Race condition - another worker got it
      return { job: null, acquired: false };
    }

    // Return the updated job
    const claimedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id) as Job;
    return { job: claimedJob, acquired: true };
  })();

  return result;
}

/**
 * Acknowledge job completion (success)
 */
export function ackJob(
  jobId: number,
  durationMs?: number
): boolean {
  const db = getDb();

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as Job | undefined;
  if (!job) return false;

  const result = db.prepare(`
    UPDATE jobs
    SET status = 'completed', completed_at = datetime('now'), error_message = NULL
    WHERE id = ? AND status = 'running'
  `).run(jobId);

  if (result.changes > 0) {
    // Record success metric
    const taskData = JSON.parse(job.task_data || '{}');
    recordTaskMetric(job.task_type, 'success', durationMs, taskData.projectName);
    return true;
  }

  return false;
}

/**
 * Negative acknowledge (failure)
 * Optionally re-queue for retry or move to dead-letter queue
 */
export function nackJob(
  jobId: number,
  errorMessage: string,
  options: { retry?: boolean; durationMs?: number } = {}
): boolean {
  const db = getDb();
  const { retry = false, durationMs } = options;

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as Job | undefined;
  if (!job) return false;

  const taskData = JSON.parse(job.task_data || '{}');

  if (retry) {
    // Re-queue with pending status
    const result = db.prepare(`
      UPDATE jobs
      SET status = 'pending', worker_id = NULL, started_at = NULL, error_message = ?
      WHERE id = ? AND status = 'running'
    `).run(errorMessage, jobId);

    return result.changes > 0;
  }

  // Mark as failed
  const result = db.prepare(`
    UPDATE jobs
    SET status = 'failed', completed_at = datetime('now'), error_message = ?
    WHERE id = ? AND status = 'running'
  `).run(errorMessage, jobId);

  if (result.changes > 0) {
    // Record failure metric
    recordTaskMetric(job.task_type, 'failure', durationMs, taskData.projectName, errorMessage);

    // Add to dead-letter queue for potential retry
    addFailedTask(job.task_type, JSON.parse(job.task_data || '{}'), errorMessage);
    return true;
  }

  return false;
}

/**
 * Get job by ID
 */
export function getJob(jobId: number): Job | null {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as Job | undefined;
  return job || null;
}

/**
 * List jobs with optional filtering
 */
export function listJobs(options: {
  status?: Job['status'];
  taskType?: string;
  limit?: number;
  offset?: number;
} = {}): { jobs: Job[]; total: number } {
  const db = getDb();
  const { status, taskType, limit = 50, offset = 0 } = options;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (taskType) {
    conditions.push('task_type = ?');
    params.push(taskType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM jobs ${whereClause}
  `).get(...params) as { count: number };

  // Get jobs
  const jobs = db.prepare(`
    SELECT * FROM jobs
    ${whereClause}
    ORDER BY priority DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Job[];

  return { jobs, total: countResult.count };
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  byTaskType: { task_type: string; count: number }[];
} {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM jobs
  `).get() as { pending: number; running: number; completed: number; failed: number };

  const byTaskType = db.prepare(`
    SELECT task_type, COUNT(*) as count
    FROM jobs
    WHERE status = 'pending'
    GROUP BY task_type
    ORDER BY count DESC
  `).all() as { task_type: string; count: number }[];

  return {
    pending: stats.pending || 0,
    running: stats.running || 0,
    completed: stats.completed || 0,
    failed: stats.failed || 0,
    byTaskType,
  };
}

/**
 * Cleanup stale running jobs (workers that crashed)
 * Jobs running for more than `staleMinutes` are reset to pending
 */
export function cleanupStaleJobs(staleMinutes = 60): number {
  const db = getDb();

  const result = db.prepare(`
    UPDATE jobs
    SET status = 'pending', worker_id = NULL, started_at = NULL,
        error_message = 'Reset: worker timed out'
    WHERE status = 'running'
      AND datetime(started_at, '+' || ? || ' minutes') < datetime('now')
  `).run(staleMinutes);

  return result.changes;
}

/**
 * Cleanup old completed/failed jobs
 */
export function cleanupOldJobs(olderThanDays = 30): number {
  const db = getDb();

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    DELETE FROM jobs
    WHERE status IN ('completed', 'failed')
      AND completed_at < ?
  `).run(cutoff);

  return result.changes;
}

/**
 * Cancel a pending job
 */
export function cancelJob(jobId: number): boolean {
  const db = getDb();

  const result = db.prepare(`
    DELETE FROM jobs
    WHERE id = ? AND status = 'pending'
  `).run(jobId);

  return result.changes > 0;
}

/**
 * Update job priority
 */
export function updateJobPriority(jobId: number, priority: number): boolean {
  const db = getDb();

  const result = db.prepare(`
    UPDATE jobs
    SET priority = ?
    WHERE id = ? AND status = 'pending'
  `).run(priority, jobId);

  return result.changes > 0;
}
