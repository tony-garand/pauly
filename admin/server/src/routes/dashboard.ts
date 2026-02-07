import { Router, type Router as RouterType } from 'express';
import { listProjects } from '../lib/projects.js';
import { getDeadLetterStats } from '../lib/deadletter.js';
import { getMetricsSummary, getMetricsTimeline } from '../lib/metrics.js';
import { getQueueStats } from '../lib/queue.js';
import { getDatabaseStats, isDatabaseInitialized } from '../lib/db.js';
import { apiCache } from '../lib/cache.js';

const router: RouterType = Router();

/**
 * @openapi
 * /dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get all dashboard data in a single request
 *     description: Batched endpoint that returns projects, metrics, queue stats, and dead-letter queue info
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/', async (_req, res) => {
  try {
    // Use cache for expensive operations
    const data = await apiCache.getOrSet('dashboard', async () => {
      const [projects, metrics, timeline, queueStats, dlqStats, dbStats] = await Promise.all([
        Promise.resolve(listProjects()),
        Promise.resolve(getMetricsSummary(7)),
        Promise.resolve(getMetricsTimeline(7, 'day')),
        Promise.resolve(getQueueStats()),
        Promise.resolve(isDatabaseInitialized() ? getDeadLetterStats() : null),
        Promise.resolve(isDatabaseInitialized() ? getDatabaseStats() : null),
      ]);

      return {
        projects: {
          total: projects.length,
          withGit: projects.filter(p => p.hasGit).length,
          withContext: projects.filter(p => p.hasContextMd).length,
          withTasks: projects.filter(p => p.tasksCompletion && p.tasksCompletion.total > 0).length,
          items: projects.slice(0, 10), // Top 10 for dashboard
        },
        metrics: {
          summary: {
            totalTasks: metrics.totalTasks,
            successRate: metrics.successRate,
            successCount: metrics.successCount,
            failureCount: metrics.failureCount,
            averageDurationMs: metrics.averageDurationMs,
          },
          byType: metrics.byTaskType,
          recentFailures: metrics.recentFailures.slice(0, 5),
          timeline,
        },
        queue: queueStats,
        deadLetterQueue: dlqStats,
        database: dbStats ? {
          size: dbStats.size,
          tables: dbStats.tables.length,
        } : null,
        timestamp: new Date().toISOString(),
      };
    }, 15); // Cache for 15 seconds

    res.json(data);
  } catch (err) {
    console.error('Failed to get dashboard data:', err);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

/**
 * @openapi
 * /dashboard/refresh:
 *   post:
 *     tags: [Dashboard]
 *     summary: Refresh dashboard cache
 *     description: Invalidates the dashboard cache forcing fresh data on next request
 *     responses:
 *       200:
 *         description: Cache cleared
 */
router.post('/refresh', (_req, res) => {
  apiCache.delete('dashboard');
  res.json({ success: true, message: 'Dashboard cache cleared' });
});

export default router;
