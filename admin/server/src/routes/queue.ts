import { Router, type Router as RouterType } from 'express';
import {
  enqueueJob,
  dequeueJob,
  ackJob,
  nackJob,
  getJob,
  listJobs,
  getQueueStats,
  cleanupStaleJobs,
  cleanupOldJobs,
  cancelJob,
  updateJobPriority,
} from '../lib/queue.js';

const router: RouterType = Router();

/**
 * @route GET /api/queue/stats
 * @description Get queue statistics
 */
router.get('/stats', (_req, res) => {
  try {
    const stats = getQueueStats();
    res.json(stats);
  } catch (err) {
    console.error('Failed to get queue stats:', err);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

/**
 * @route GET /api/queue/jobs
 * @description List jobs with optional filtering
 */
router.get('/jobs', (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const taskType = req.query.taskType as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const validStatuses = ['pending', 'running', 'completed', 'failed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = listJobs({
      status: status as 'pending' | 'running' | 'completed' | 'failed' | undefined,
      taskType,
      limit,
      offset,
    });

    res.json(result);
  } catch (err) {
    console.error('Failed to list jobs:', err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * @route GET /api/queue/jobs/:id
 * @description Get a specific job by ID
 */
router.get('/jobs/:id', (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (err) {
    console.error('Failed to get job:', err);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

/**
 * @route POST /api/queue/enqueue
 * @description Add a new job to the queue
 */
router.post('/enqueue', (req, res) => {
  try {
    const { taskType, priority, blockedBy, taskData } = req.body;

    if (!taskType || typeof taskType !== 'string') {
      return res.status(400).json({ error: 'taskType is required' });
    }

    const jobId = enqueueJob(taskType, {
      priority: typeof priority === 'number' ? priority : undefined,
      blockedBy: Array.isArray(blockedBy) ? blockedBy : undefined,
      taskData: typeof taskData === 'object' ? taskData : undefined,
    });

    res.status(201).json({ id: jobId, message: 'Job enqueued' });
  } catch (err) {
    console.error('Failed to enqueue job:', err);
    res.status(500).json({ error: 'Failed to enqueue job' });
  }
});

/**
 * @route POST /api/queue/dequeue
 * @description Atomically dequeue the next available job
 */
router.post('/dequeue', (req, res) => {
  try {
    const { workerId } = req.body;

    if (!workerId || typeof workerId !== 'string') {
      return res.status(400).json({ error: 'workerId is required' });
    }

    const result = dequeueJob(workerId);
    res.json(result);
  } catch (err) {
    console.error('Failed to dequeue job:', err);
    res.status(500).json({ error: 'Failed to dequeue job' });
  }
});

/**
 * @route POST /api/queue/jobs/:id/ack
 * @description Acknowledge successful job completion
 */
router.post('/jobs/:id/ack', (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const { durationMs } = req.body;
    const success = ackJob(jobId, typeof durationMs === 'number' ? durationMs : undefined);

    if (!success) {
      return res.status(404).json({ error: 'Job not found or not running' });
    }

    res.json({ success: true, message: 'Job acknowledged' });
  } catch (err) {
    console.error('Failed to ack job:', err);
    res.status(500).json({ error: 'Failed to ack job' });
  }
});

/**
 * @route POST /api/queue/jobs/:id/nack
 * @description Negative acknowledge (failure)
 */
router.post('/jobs/:id/nack', (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const { errorMessage, retry, durationMs } = req.body;

    if (!errorMessage || typeof errorMessage !== 'string') {
      return res.status(400).json({ error: 'errorMessage is required' });
    }

    const success = nackJob(jobId, errorMessage, {
      retry: retry === true,
      durationMs: typeof durationMs === 'number' ? durationMs : undefined,
    });

    if (!success) {
      return res.status(404).json({ error: 'Job not found or not running' });
    }

    res.json({ success: true, message: retry ? 'Job re-queued' : 'Job failed' });
  } catch (err) {
    console.error('Failed to nack job:', err);
    res.status(500).json({ error: 'Failed to nack job' });
  }
});

/**
 * @route DELETE /api/queue/jobs/:id
 * @description Cancel a pending job
 */
router.delete('/jobs/:id', (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const success = cancelJob(jobId);

    if (!success) {
      return res.status(404).json({ error: 'Job not found or not pending' });
    }

    res.json({ success: true, message: 'Job cancelled' });
  } catch (err) {
    console.error('Failed to cancel job:', err);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

/**
 * @route PATCH /api/queue/jobs/:id/priority
 * @description Update job priority
 */
router.patch('/jobs/:id/priority', (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const { priority } = req.body;
    if (typeof priority !== 'number') {
      return res.status(400).json({ error: 'priority must be a number' });
    }

    const success = updateJobPriority(jobId, priority);

    if (!success) {
      return res.status(404).json({ error: 'Job not found or not pending' });
    }

    res.json({ success: true, message: 'Priority updated' });
  } catch (err) {
    console.error('Failed to update priority:', err);
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

/**
 * @route POST /api/queue/cleanup
 * @description Cleanup stale and old jobs
 */
router.post('/cleanup', (req, res) => {
  try {
    const staleMinutes = parseInt(req.query.staleMinutes as string, 10) || 60;
    const olderThanDays = parseInt(req.query.olderThanDays as string, 10) || 30;

    const staleReset = cleanupStaleJobs(staleMinutes);
    const oldDeleted = cleanupOldJobs(olderThanDays);

    res.json({
      success: true,
      staleJobsReset: staleReset,
      oldJobsDeleted: oldDeleted,
    });
  } catch (err) {
    console.error('Failed to cleanup jobs:', err);
    res.status(500).json({ error: 'Failed to cleanup jobs' });
  }
});

export default router;
