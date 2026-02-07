#!/usr/bin/env node

/**
 * Queue CLI for Pauly task queue operations
 * Used by bash scripts to interact with the SQLite task queue
 *
 * Usage:
 *   node queue.js enqueue <task_type> [--priority=N] [--blocked-by=id1,id2] [--data='{}']
 *   node queue.js dequeue <worker_id>
 *   node queue.js ack <job_id> [--duration=ms]
 *   node queue.js nack <job_id> --error="message" [--retry] [--duration=ms]
 *   node queue.js status
 *   node queue.js get <job_id>
 *   node queue.js list [--status=pending|running|completed|failed] [--limit=N]
 *   node queue.js cleanup [--stale-minutes=60] [--older-than-days=30]
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';

const DB_DIR = join(homedir(), '.pauly', 'data');
const DB_PATH = join(DB_DIR, 'pauly.db');

// Ensure database directory exists
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Ensure jobs table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,
    task_data TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    worker_id TEXT,
    blocked_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority DESC);
`);

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

function parseArgs(args) {
  const result = { positional: [], flags: {} };
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=');
      result.flags[key] = valueParts.join('=') || 'true';
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

const parsed = parseArgs(args.slice(1));

function output(data) {
  console.log(JSON.stringify(data));
}

function exitWithError(message, code = 1) {
  console.error(JSON.stringify({ error: message }));
  process.exit(code);
}

switch (command) {
  case 'enqueue': {
    const taskType = parsed.positional[0];
    if (!taskType) exitWithError('task_type required');

    const priority = parseInt(parsed.flags.priority || '0', 10);
    const blockedBy = parsed.flags['blocked-by']
      ? JSON.stringify(parsed.flags['blocked-by'].split(',').map(Number))
      : null;
    const taskData = parsed.flags.data || '{}';

    const result = db.prepare(`
      INSERT INTO jobs (task_type, task_data, priority, blocked_by)
      VALUES (?, ?, ?, ?)
    `).run(taskType, taskData, priority, blockedBy);

    output({ id: result.lastInsertRowid, message: 'Job enqueued' });
    break;
  }

  case 'dequeue': {
    const workerId = parsed.positional[0];
    if (!workerId) exitWithError('worker_id required');

    const result = db.transaction(() => {
      // Find next available job
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
      `).get();

      if (!job) {
        return { job: null, acquired: false };
      }

      // Claim the job
      const updateResult = db.prepare(`
        UPDATE jobs
        SET status = 'running', worker_id = ?, started_at = datetime('now')
        WHERE id = ? AND status = 'pending'
      `).run(workerId, job.id);

      if (updateResult.changes === 0) {
        return { job: null, acquired: false };
      }

      const claimedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id);
      return { job: claimedJob, acquired: true };
    })();

    output(result);
    break;
  }

  case 'ack': {
    const jobId = parseInt(parsed.positional[0], 10);
    if (isNaN(jobId)) exitWithError('job_id required');

    const result = db.prepare(`
      UPDATE jobs
      SET status = 'completed', completed_at = datetime('now')
      WHERE id = ? AND status = 'running'
    `).run(jobId);

    output({ success: result.changes > 0 });
    break;
  }

  case 'nack': {
    const jobId = parseInt(parsed.positional[0], 10);
    if (isNaN(jobId)) exitWithError('job_id required');

    const errorMessage = parsed.flags.error || 'Unknown error';
    const retry = parsed.flags.retry === 'true';

    if (retry) {
      const result = db.prepare(`
        UPDATE jobs
        SET status = 'pending', worker_id = NULL, started_at = NULL, error_message = ?
        WHERE id = ? AND status = 'running'
      `).run(errorMessage, jobId);
      output({ success: result.changes > 0, requeued: true });
    } else {
      const result = db.prepare(`
        UPDATE jobs
        SET status = 'failed', completed_at = datetime('now'), error_message = ?
        WHERE id = ? AND status = 'running'
      `).run(errorMessage, jobId);
      output({ success: result.changes > 0, failed: true });
    }
    break;
  }

  case 'status': {
    const stats = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM jobs
    `).get();

    const byType = db.prepare(`
      SELECT task_type, COUNT(*) as count
      FROM jobs WHERE status = 'pending'
      GROUP BY task_type
    `).all();

    output({ ...stats, byTaskType: byType });
    break;
  }

  case 'get': {
    const jobId = parseInt(parsed.positional[0], 10);
    if (isNaN(jobId)) exitWithError('job_id required');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    output(job || { error: 'Job not found' });
    break;
  }

  case 'list': {
    const status = parsed.flags.status;
    const limit = parseInt(parsed.flags.limit || '50', 10);

    let query = 'SELECT * FROM jobs';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY priority DESC, created_at DESC LIMIT ?';
    params.push(limit);

    const jobs = db.prepare(query).all(...params);
    output({ jobs, count: jobs.length });
    break;
  }

  case 'cleanup': {
    const staleMinutes = parseInt(parsed.flags['stale-minutes'] || '60', 10);
    const olderThanDays = parseInt(parsed.flags['older-than-days'] || '30', 10);

    // Reset stale running jobs
    const staleResult = db.prepare(`
      UPDATE jobs
      SET status = 'pending', worker_id = NULL, started_at = NULL,
          error_message = 'Reset: worker timed out'
      WHERE status = 'running'
        AND datetime(started_at, '+' || ? || ' minutes') < datetime('now')
    `).run(staleMinutes);

    // Delete old completed/failed jobs
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const deleteResult = db.prepare(`
      DELETE FROM jobs
      WHERE status IN ('completed', 'failed')
        AND completed_at < ?
    `).run(cutoff);

    output({
      staleReset: staleResult.changes,
      oldDeleted: deleteResult.changes
    });
    break;
  }

  default:
    exitWithError(`Unknown command: ${command}. Use: enqueue, dequeue, ack, nack, status, get, list, cleanup`);
}

db.close();
