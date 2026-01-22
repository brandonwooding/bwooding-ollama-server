// src/db/analytics.ts
import { db } from './client.js';
import type { TurnLog } from '../analytics/store.js';

// Prepared statement
const insertTurnLogStmt = db.prepare(`
  INSERT INTO turn_logs (
    session_id,
    turn_id,
    user_content,
    user_at,
    user_word_count,
    assistant_content,
    assistant_at,
    assistant_word_count,
    latency_ms,
    context_word_count
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Insert a turn log into the database.
 * Called after each completed user-assistant exchange.
 */
export function dbInsertTurnLog(turn: TurnLog): void {
  insertTurnLogStmt.run(
    turn.sessionId,
    turn.turnId,
    turn.user.content,
    turn.user.at,
    turn.user.wordCount,
    turn.assistant.content,
    turn.assistant.at,
    turn.assistant.wordCount,
    turn.latencyMs,
    turn.contextWordCount
  );
}
