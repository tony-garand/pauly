import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_DIR = join(homedir(), '.pauly', 'logs');
const LOG_FILE = join(LOG_DIR, 'server.jsonl');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Ensure log directory exists
 */
function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Rotate log files if needed
 */
function rotateLogsIfNeeded(): void {
  if (!existsSync(LOG_FILE)) return;

  const stats = statSync(LOG_FILE);
  if (stats.size < MAX_LOG_SIZE) return;

  // Rotate files
  for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
    const oldFile = `${LOG_FILE}.${i}`;
    const newFile = `${LOG_FILE}.${i + 1}`;
    if (existsSync(oldFile)) {
      if (i === MAX_LOG_FILES - 1) {
        // Delete oldest file
        require('fs').unlinkSync(oldFile);
      } else {
        renameSync(oldFile, newFile);
      }
    }
  }

  // Rotate current log
  renameSync(LOG_FILE, `${LOG_FILE}.1`);
}

/**
 * Write a log entry to the JSONL file
 */
function writeLog(entry: LogEntry): void {
  ensureLogDir();
  rotateLogsIfNeeded();

  const line = JSON.stringify(entry) + '\n';
  appendFileSync(LOG_FILE, line);
}

/**
 * Create a log entry
 */
function createEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) {
    entry.context = context;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

/**
 * Logger with structured JSON output
 */
export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    const entry = createEntry('debug', message, context);
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${entry.timestamp}] DEBUG: ${message}`, context || '');
    }
    writeLog(entry);
  },

  info(message: string, context?: Record<string, unknown>): void {
    const entry = createEntry('info', message, context);
    console.log(`[${entry.timestamp}] INFO: ${message}`, context || '');
    writeLog(entry);
  },

  warn(message: string, context?: Record<string, unknown>): void {
    const entry = createEntry('warn', message, context);
    console.warn(`[${entry.timestamp}] WARN: ${message}`, context || '');
    writeLog(entry);
  },

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry = createEntry('error', message, context, error);
    console.error(`[${entry.timestamp}] ERROR: ${message}`, error || '', context || '');
    writeLog(entry);
  },

  /**
   * Log a request (for middleware)
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: Record<string, unknown>
  ): void {
    const entry = createEntry('info', `${method} ${path} ${statusCode}`, {
      ...context,
      method,
      path,
      statusCode,
      durationMs,
    });
    writeLog(entry);
  },
};

export default logger;
