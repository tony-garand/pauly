import { Router, type Router as RouterType } from 'express';
import {
  listFailedTasks,
  getFailedTask,
  resolveTask,
  retryTaskNow,
  deleteFailedTask,
  getDeadLetterStats,
  cleanupResolvedTasks,
  getRetryableTasks,
} from '../lib/deadletter.js';

const router: RouterType = Router();

/**
 * @route GET /api/deadletter
 * @description List all failed tasks
 */
router.get('/', (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const validStatuses = ['pending', 'retrying', 'resolved', 'abandoned'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const tasks = listFailedTasks(status as any);
    res.json({ tasks });
  } catch (err) {
    console.error('Failed to list failed tasks:', err);
    res.status(500).json({ error: 'Failed to list failed tasks' });
  }
});

/**
 * @route GET /api/deadletter/stats
 * @description Get dead-letter queue statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getDeadLetterStats();
    res.json(stats);
  } catch (err) {
    console.error('Failed to get DLQ stats:', err);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * @route GET /api/deadletter/retryable
 * @description Get tasks that are ready for retry
 */
router.get('/retryable', (req, res) => {
  try {
    const tasks = getRetryableTasks();
    res.json({ tasks });
  } catch (err) {
    console.error('Failed to get retryable tasks:', err);
    res.status(500).json({ error: 'Failed to get retryable tasks' });
  }
});

/**
 * @route GET /api/deadletter/:id
 * @description Get a specific failed task
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const task = getFailedTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  } catch (err) {
    console.error('Failed to get failed task:', err);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

/**
 * @route POST /api/deadletter/:id/retry
 * @description Immediately retry a failed task
 */
router.post('/:id/retry', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const task = retryTaskNow(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task, message: 'Task scheduled for immediate retry' });
  } catch (err) {
    console.error('Failed to retry task:', err);
    res.status(500).json({ error: 'Failed to retry task' });
  }
});

/**
 * @route POST /api/deadletter/:id/resolve
 * @description Mark a failed task as resolved
 */
router.post('/:id/resolve', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const success = resolveTask(id);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, message: 'Task marked as resolved' });
  } catch (err) {
    console.error('Failed to resolve task:', err);
    res.status(500).json({ error: 'Failed to resolve task' });
  }
});

/**
 * @route DELETE /api/deadletter/:id
 * @description Delete a failed task
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const success = deleteFailedTask(id);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('Failed to delete task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * @route POST /api/deadletter/cleanup
 * @description Cleanup old resolved tasks
 */
router.post('/cleanup', (req, res) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const deleted = cleanupResolvedTasks(days);
    res.json({ success: true, deleted, message: `Deleted ${deleted} old resolved tasks` });
  } catch (err) {
    console.error('Failed to cleanup tasks:', err);
    res.status(500).json({ error: 'Failed to cleanup tasks' });
  }
});

export default router;
