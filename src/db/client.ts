// src/db/client.ts
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'ollama-analytics.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db: BetterSqlite3.Database = new Database(DB_PATH);

// Performance optimizations
db.pragma('journal_mode = WAL');        // Write-Ahead Logging for better concurrency
db.pragma('synchronous = NORMAL');       // Balance between safety and performance
db.pragma('busy_timeout = 5000');       // Wait up to 5s for locks
db.pragma('cache_size = -64000');       // 64MB cache

// Initialize schema immediately (before any prepared statements are created)
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expired_at INTEGER,
    reset_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    was_trimmed INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, position);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

  CREATE TABLE IF NOT EXISTS turn_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    turn_id TEXT NOT NULL UNIQUE,
    user_content TEXT NOT NULL,
    user_at INTEGER NOT NULL,
    user_word_count INTEGER NOT NULL,
    assistant_content TEXT NOT NULL,
    assistant_at INTEGER NOT NULL,
    assistant_word_count INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    context_word_count INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
  );

  CREATE INDEX IF NOT EXISTS idx_turns_session ON turn_logs(session_id);
  CREATE INDEX IF NOT EXISTS idx_turns_created ON turn_logs(user_at);
  CREATE INDEX IF NOT EXISTS idx_turns_latency ON turn_logs(latency_ms);
`);

console.log('[DB] Schema initialized');

// Graceful shutdown
process.on('exit', () => db.close());
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

/**
 * Safe wrapper for database writes that never throws.
 * Logs errors but doesn't block the application.
 */
export function dbWriteSafe(operation: () => void, context: string): void {
  try {
    operation();
  } catch (err) {
    console.error(`[DB Error] ${context}:`, err);
    // Don't throw - log and continue
  }
}
