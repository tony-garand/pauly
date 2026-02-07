import { Router, type Router as RouterType } from 'express';
import {
  getMetricsSummary,
  getMetricsTimeline,
  getProjectMetrics,
  cleanupOldMetrics,
} from '../lib/metrics.js';

const router: RouterType = Router();

/**
 * @route GET /api/metrics/summary
 * @description Get metrics summary for the last N days
 */
router.get('/summary', (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const summary = getMetricsSummary(days);
    res.json(summary);
  } catch (err) {
    console.error('Failed to get metrics summary:', err);
    res.status(500).json({ error: 'Failed to get metrics summary' });
  }
});

/**
 * @route GET /api/metrics/timeline
 * @description Get metrics over time for charting
 */
router.get('/timeline', (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const granularity = (req.query.granularity as 'hour' | 'day') || 'day';

    if (!['hour', 'day'].includes(granularity)) {
      return res.status(400).json({ error: 'Granularity must be "hour" or "day"' });
    }

    const timeline = getMetricsTimeline(days, granularity);
    res.json({ timeline });
  } catch (err) {
    console.error('Failed to get metrics timeline:', err);
    res.status(500).json({ error: 'Failed to get metrics timeline' });
  }
});

/**
 * @route GET /api/metrics/projects/:name
 * @description Get metrics for a specific project
 */
router.get('/projects/:name', (req, res) => {
  try {
    const { name } = req.params;
    const days = parseInt(req.query.days as string, 10) || 30;
    const metrics = getProjectMetrics(name, days);
    res.json(metrics);
  } catch (err) {
    console.error('Failed to get project metrics:', err);
    res.status(500).json({ error: 'Failed to get project metrics' });
  }
});

/**
 * @route POST /api/metrics/cleanup
 * @description Cleanup old metrics data
 */
router.post('/cleanup', (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 90;
    const deleted = cleanupOldMetrics(days);
    res.json({ success: true, deleted, message: `Deleted ${deleted} old metrics` });
  } catch (err) {
    console.error('Failed to cleanup metrics:', err);
    res.status(500).json({ error: 'Failed to cleanup metrics' });
  }
});

export default router;
