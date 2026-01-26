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

  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    heading TEXT,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL,
    char_count INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    document_type TEXT DEFAULT 'general',
    created_at INTEGER NOT NULL,
    UNIQUE(source_file, chunk_index)
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_source ON knowledge_chunks(source_file);
  CREATE INDEX IF NOT EXISTS idx_chunks_created ON knowledge_chunks(created_at);

  CREATE TABLE IF NOT EXISTS retrieval_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    turn_id TEXT,
    query TEXT NOT NULL,
    chunks_retrieved INTEGER NOT NULL,
    retrieval_latency_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
  );

  CREATE INDEX IF NOT EXISTS idx_retrieval_session ON retrieval_logs(session_id);
  CREATE INDEX IF NOT EXISTS idx_retrieval_turn ON retrieval_logs(turn_id);
`);

console.log('[DB] Schema initialized');

// Migration: Add document_type column if it doesn't exist
try {
  const tableInfo = db.pragma('table_info(knowledge_chunks)') as Array<{ name: string }>;
  const hasDocumentType = tableInfo.some((col) => col.name === 'document_type');

  if (!hasDocumentType) {
    console.log('[DB Migration] Adding document_type column to knowledge_chunks...');
    db.exec(`
      ALTER TABLE knowledge_chunks ADD COLUMN document_type TEXT DEFAULT 'general';
      CREATE INDEX IF NOT EXISTS idx_chunks_document_type ON knowledge_chunks(document_type);
    `);
    console.log('[DB Migration] Migration complete');
  }
} catch (err) {
  console.error('[DB Migration] Error during migration:', err);
}

// Migration: Add classification column to retrieval_logs if it doesn't exist
try {
  const retrievalTableInfo = db.pragma('table_info(retrieval_logs)') as Array<{ name: string }>;
  const hasClassification = retrievalTableInfo.some((col) => col.name === 'classification');

  if (!hasClassification) {
    console.log('[DB Migration] Adding classification column to retrieval_logs...');
    db.exec(`
      ALTER TABLE retrieval_logs ADD COLUMN classification TEXT;
    `);
    console.log('[DB Migration] Migration complete');
  }
} catch (err) {
  console.error('[DB Migration] Error during migration:', err);
}

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
