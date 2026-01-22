// src/db/messages.ts
import { db } from './client.js';

// Prepared statements
const insertMessageStmt = db.prepare(`
  INSERT INTO messages (session_id, role, content, position, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const markTrimmedStmt = db.prepare(`
  UPDATE messages
  SET was_trimmed = 1
  WHERE session_id = ? AND position = ?
`);

/**
 * Insert a message into the database.
 * Called when user or assistant messages are added to a session.
 */
export function dbInsertMessage(
  sessionId: string,
  role: 'system' | 'user' | 'assistant',
  content: string,
  position: number,
  timestamp: number
): void {
  insertMessageStmt.run(sessionId, role, content, position, timestamp);
}

/**
 * Mark messages as trimmed (removed from active context).
 * Called when the session trimming logic removes old messages.
 */
export function dbMarkMessagesTrimmed(
  sessionId: string,
  positions: number[]
): void {
  if (positions.length === 0) return;

  // Use transaction for batch update
  const markMultiple = db.transaction((sid: string, pos: number[]) => {
    for (const p of pos) {
      markTrimmedStmt.run(sid, p);
    }
  });

  markMultiple(sessionId, positions);
}
