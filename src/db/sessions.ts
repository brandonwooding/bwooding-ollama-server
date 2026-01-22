// src/db/sessions.ts
import { db } from './client.js';

// Prepared statements for better performance
const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (session_id, created_at, first_seen_at, last_seen_at)
  VALUES (?, ?, ?, ?)
`);

const updateLastSeenStmt = db.prepare(`
  UPDATE sessions
  SET last_seen_at = ?
  WHERE session_id = ?
`);

const markExpiredStmt = db.prepare(`
  UPDATE sessions
  SET expired_at = ?
  WHERE session_id = ?
`);

const incrementResetCountStmt = db.prepare(`
  UPDATE sessions
  SET reset_count = reset_count + 1
  WHERE session_id = ?
`);

/**
 * Create a new session in the database.
 * Called when a new session is first created.
 */
export function dbCreateSession(sessionId: string, timestamp: number): void {
  insertSessionStmt.run(sessionId, timestamp, timestamp, timestamp);
}

/**
 * Update the last_seen_at timestamp for a session.
 * Called on every user/assistant message.
 */
export function dbUpdateLastSeen(sessionId: string, timestamp: number): void {
  updateLastSeenStmt.run(timestamp, sessionId);
}

/**
 * Mark sessions as expired.
 * Called by cleanup function when sessions exceed TTL.
 */
export function dbMarkExpired(sessionIds: string[], timestamp: number): void {
  if (sessionIds.length === 0) return;

  // Use transaction for batch update
  const markMultiple = db.transaction((ids: string[], ts: number) => {
    for (const id of ids) {
      markExpiredStmt.run(ts, id);
    }
  });

  markMultiple(sessionIds, timestamp);
}

/**
 * Increment the reset count for a session.
 * Called when user clicks "new chat" but keeps the same session.
 */
export function dbIncrementResetCount(sessionId: string): void {
  incrementResetCountStmt.run(sessionId);
}
