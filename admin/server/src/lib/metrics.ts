import { getDb } from './db.js';

export interface TaskMetric {
  id: number;
  task_type: string;
  project_name: string | null;
  status: 'success' | 'failure';
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface MetricsSummary {
  totalTasks: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  byTaskType: {
    task_type: string;
    total: number;
    success: number;
    failure: number;
    successRate: number;
    avgDuration: number;
  }[];
  recentFailures: TaskMetric[];
}

/**
 * Record a task execution metric
 */
export function recordTaskMetric(
  taskType: string,
  status: 'success' | 'failure',
  durationMs?: number,
  projectName?: string,
  errorMessage?: string
): void {
  const db = getDb();

  db.prepare(`
    INSERT INTO task_metrics (task_type, project_name, status, duration_ms, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).run(taskType, projectName || null, status, durationMs || null, errorMessage || null);
}

/**
 * Get metrics summary
 */
export function getMetricsSummary(days = 7): MetricsSummary {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Total counts
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
      AVG(duration_ms) as avg_duration
    FROM task_metrics
    WHERE created_at >= ?
  `).get(cutoff) as { total: number; success: number; failure: number; avg_duration: number };

  // By task type
  const byTaskType = db.prepare(`
    SELECT
      task_type,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
      AVG(duration_ms) as avg_duration
    FROM task_metrics
    WHERE created_at >= ?
    GROUP BY task_type
    ORDER BY total DESC
  `).all(cutoff) as {
    task_type: string;
    total: number;
    success: number;
    failure: number;
    avg_duration: number;
  }[];

  // Recent failures
  const recentFailures = db.prepare(`
    SELECT * FROM task_metrics
    WHERE status = 'failure' AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(cutoff) as TaskMetric[];

  return {
    totalTasks: totals.total || 0,
    successCount: totals.success || 0,
    failureCount: totals.failure || 0,
    successRate: totals.total > 0 ? (totals.success / totals.total) * 100 : 0,
    averageDurationMs: Math.round(totals.avg_duration || 0),
    byTaskType: byTaskType.map(t => ({
      task_type: t.task_type,
      total: t.total,
      success: t.success,
      failure: t.failure,
      successRate: t.total > 0 ? (t.success / t.total) * 100 : 0,
      avgDuration: Math.round(t.avg_duration || 0),
    })),
    recentFailures,
  };
}

/**
 * Get metrics over time (for charts)
 */
export function getMetricsTimeline(days = 7, granularity: 'hour' | 'day' = 'day'): {
  timestamp: string;
  success: number;
  failure: number;
}[] {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const dateFormat = granularity === 'hour'
    ? "strftime('%Y-%m-%d %H:00', created_at)"
    : "date(created_at)";

  const results = db.prepare(`
    SELECT
      ${dateFormat} as timestamp,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure
    FROM task_metrics
    WHERE created_at >= ?
    GROUP BY ${dateFormat}
    ORDER BY timestamp ASC
  `).all(cutoff) as { timestamp: string; success: number; failure: number }[];

  return results;
}

/**
 * Get project-specific metrics
 */
export function getProjectMetrics(projectName: string, days = 30): {
  totalTasks: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  timeline: { timestamp: string; success: number; failure: number }[];
} {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
      AVG(duration_ms) as avg_duration
    FROM task_metrics
    WHERE project_name = ? AND created_at >= ?
  `).get(projectName, cutoff) as { total: number; success: number; failure: number; avg_duration: number };

  const timeline = db.prepare(`
    SELECT
      date(created_at) as timestamp,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure
    FROM task_metrics
    WHERE project_name = ? AND created_at >= ?
    GROUP BY date(created_at)
    ORDER BY timestamp ASC
  `).all(projectName, cutoff) as { timestamp: string; success: number; failure: number }[];

  return {
    totalTasks: totals.total || 0,
    successCount: totals.success || 0,
    failureCount: totals.failure || 0,
    successRate: totals.total > 0 ? (totals.success / totals.total) * 100 : 0,
    averageDurationMs: Math.round(totals.avg_duration || 0),
    timeline,
  };
}

/**
 * Cleanup old metrics
 */
export function cleanupOldMetrics(olderThanDays = 90): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare('DELETE FROM task_metrics WHERE created_at < ?').run(cutoff);
  return result.changes;
}
