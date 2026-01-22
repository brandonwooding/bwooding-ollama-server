// src/db/schema.ts
import { db } from './client.js';

/**
 * Initialize database schema (idempotent).
 * Safe to call on every startup - only creates tables if they don't exist.
 */
export function initializeSchema(): void {
  db.exec(`
    -- Sessions table: Track all chat sessions
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,      -- unix ms
      first_seen_at INTEGER NOT NULL,   -- unix ms (same as created_at)
      last_seen_at INTEGER NOT NULL,    -- unix ms (updated on activity)
      expired_at INTEGER,                -- unix ms (set when TTL cleanup runs)
      reset_count INTEGER DEFAULT 0     -- how many times user clicked "new chat"
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);

    -- Messages table: All messages in conversations
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,               -- 'system' | 'user' | 'assistant'
      content TEXT NOT NULL,
      position INTEGER NOT NULL,        -- position in conversation (0-based)
      created_at INTEGER NOT NULL,      -- unix ms
      was_trimmed INTEGER DEFAULT 0,    -- 1 if later removed by trimming logic

      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, position);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

    -- Turn logs table: Analytics for each user-assistant exchange
    CREATE TABLE IF NOT EXISTS turn_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      turn_id TEXT NOT NULL UNIQUE,

      -- User message
      user_content TEXT NOT NULL,
      user_at INTEGER NOT NULL,
      user_word_count INTEGER NOT NULL,

      -- Assistant message
      assistant_content TEXT NOT NULL,
      assistant_at INTEGER NOT NULL,
      assistant_word_count INTEGER NOT NULL,

      -- Metrics
      latency_ms INTEGER NOT NULL,
      context_word_count INTEGER NOT NULL,

      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_turns_session ON turn_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_turns_created ON turn_logs(user_at);
    CREATE INDEX IF NOT EXISTS idx_turns_latency ON turn_logs(latency_ms);
  `);

  console.log('[DB] Schema initialized successfully');
}
