import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, statSync } from 'fs';

const DB_DIR = join(homedir(), '.pauly', 'data');
const DB_PATH = join(DB_DIR, 'pauly.db');

let db: Database.Database | null = null;

/**
 * Initialize the SQLite database and create tables if they don't exist
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- Dead-letter queue for failed tasks
    CREATE TABLE IF NOT EXISTS failed_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type TEXT NOT NULL,
      task_data TEXT NOT NULL,
      error_message TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 5,
      next_retry_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'resolved', 'abandoned'))
    );

    -- Task metrics for observability
    CREATE TABLE IF NOT EXISTS task_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type TEXT NOT NULL,
      project_name TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
      duration_ms INTEGER,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Task queue for job scheduling
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

    -- Users table for multi-user support
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    -- Sessions table for auth
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Project access control
    CREATE TABLE IF NOT EXISTS project_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_name TEXT NOT NULL,
      access_level TEXT DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, project_name)
    );

    -- Audit log for tracking actions
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_failed_tasks_status ON failed_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_failed_tasks_next_retry ON failed_tasks(next_retry_at);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_type ON task_metrics(task_type);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_created ON task_metrics(created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
  `);

  return db;
}

/**
 * Get the database instance (initialize if needed)
 */
export function getDb(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return db !== null;
}

/**
 * Get database stats
 */
export function getDatabaseStats(): {
  path: string;
  size: number;
  tables: { name: string; rowCount: number }[];
} {
  const database = getDb();

  // Get file size
  const stats = statSync(DB_PATH);

  // Get table counts
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];

  const tableStats = tables.map(({ name }) => {
    const result = database.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number };
    return { name, rowCount: result.count };
  });

  return {
    path: DB_PATH,
    size: stats.size,
    tables: tableStats,
  };
}
