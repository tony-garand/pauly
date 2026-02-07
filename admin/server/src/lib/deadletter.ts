import { getDb } from './db.js';

export interface FailedTask {
  id: number;
  task_type: string;
  task_data: string;
  error_message: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  status: 'pending' | 'retrying' | 'resolved' | 'abandoned';
}

/**
 * Calculate exponential backoff delay in seconds
 */
function calculateBackoff(retryCount: number, baseDelaySeconds = 60): number {
  // Exponential backoff: 1min, 2min, 4min, 8min, 16min, etc.
  // With jitter to prevent thundering herd
  const exponentialDelay = baseDelaySeconds * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.round(exponentialDelay + jitter);
}

/**
 * Add a failed task to the dead-letter queue
 */
export function addFailedTask(
  taskType: string,
  taskData: object,
  errorMessage: string,
  maxRetries = 5
): FailedTask {
  const db = getDb();
  const nextRetry = new Date(Date.now() + calculateBackoff(0) * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT INTO failed_tasks (task_type, task_data, error_message, max_retries, next_retry_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    taskType,
    JSON.stringify(taskData),
    errorMessage,
    maxRetries,
    nextRetry
  );

  return getFailedTask(result.lastInsertRowid as number)!;
}

/**
 * Get a failed task by ID
 */
export function getFailedTask(id: number): FailedTask | null {
  const db = getDb();
  return db.prepare('SELECT * FROM failed_tasks WHERE id = ?').get(id) as FailedTask | null;
}

/**
 * Get all failed tasks with optional status filter
 */
export function listFailedTasks(status?: FailedTask['status']): FailedTask[] {
  const db = getDb();

  if (status) {
    return db
      .prepare('SELECT * FROM failed_tasks WHERE status = ? ORDER BY created_at DESC')
      .all(status) as FailedTask[];
  }

  return db
    .prepare('SELECT * FROM failed_tasks ORDER BY created_at DESC')
    .all() as FailedTask[];
}

/**
 * Get tasks ready for retry
 */
export function getRetryableTasks(): FailedTask[] {
  const db = getDb();
  const now = new Date().toISOString();

  return db
    .prepare(`
      SELECT * FROM failed_tasks
      WHERE status IN ('pending', 'retrying')
        AND retry_count < max_retries
        AND (next_retry_at IS NULL OR next_retry_at <= ?)
      ORDER BY next_retry_at ASC
    `)
    .all(now) as FailedTask[];
}

/**
 * Increment retry count and schedule next retry
 */
export function incrementRetry(id: number): FailedTask | null {
  const db = getDb();
  const task = getFailedTask(id);

  if (!task) return null;

  const newRetryCount = task.retry_count + 1;
  const nextRetry = newRetryCount < task.max_retries
    ? new Date(Date.now() + calculateBackoff(newRetryCount) * 1000).toISOString()
    : null;
  const newStatus = newRetryCount >= task.max_retries ? 'abandoned' : 'retrying';

  db.prepare(`
    UPDATE failed_tasks
    SET retry_count = ?,
        next_retry_at = ?,
        status = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(newRetryCount, nextRetry, newStatus, id);

  return getFailedTask(id);
}

/**
 * Mark a task as resolved
 */
export function resolveTask(id: number): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE failed_tasks
    SET status = 'resolved',
        resolved_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  return result.changes > 0;
}

/**
 * Manually retry a task (reset status and schedule immediate retry)
 */
export function retryTaskNow(id: number): FailedTask | null {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE failed_tasks
    SET status = 'pending',
        next_retry_at = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(now, id);

  return getFailedTask(id);
}

/**
 * Delete a failed task
 */
export function deleteFailedTask(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM failed_tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Get dead-letter queue statistics
 */
export function getDeadLetterStats(): {
  total: number;
  pending: number;
  retrying: number;
  resolved: number;
  abandoned: number;
  byTaskType: { task_type: string; count: number }[];
} {
  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as count FROM failed_tasks').get() as { count: number }).count;

  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM failed_tasks GROUP BY status
  `).all() as { status: string; count: number }[];

  const byTaskType = db.prepare(`
    SELECT task_type, COUNT(*) as count FROM failed_tasks
    WHERE status NOT IN ('resolved')
    GROUP BY task_type
    ORDER BY count DESC
  `).all() as { task_type: string; count: number }[];

  const getCount = (status: string) =>
    statusCounts.find(s => s.status === status)?.count ?? 0;

  return {
    total,
    pending: getCount('pending'),
    retrying: getCount('retrying'),
    resolved: getCount('resolved'),
    abandoned: getCount('abandoned'),
    byTaskType,
  };
}

/**
 * Cleanup old resolved tasks (older than specified days)
 */
export function cleanupResolvedTasks(olderThanDays = 30): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    DELETE FROM failed_tasks
    WHERE status = 'resolved' AND resolved_at < ?
  `).run(cutoff);

  return result.changes;
}
