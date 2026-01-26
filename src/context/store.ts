// src/context/store.ts
import type { ChatMessage } from '../ollama.js';
import { SYSTEM_PROMPT } from '../ollama.js';
import { dbWriteSafe } from '../db/client.js';
import { dbCreateSession, dbUpdateLastSeen, dbMarkExpired, dbIncrementResetCount } from '../db/sessions.js';
import { dbInsertMessage, dbMarkMessagesTrimmed } from '../db/messages.js';

export type SessionId = string;

export type SessionState = {
  messages: ChatMessage[];
  createdAt: number;  // unix ms
  lastSeenAt: number; // unix ms
};

const sessions = new Map<SessionId, SessionState>();

// Tunables (keep these simple while you learn)
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const MAX_MESSAGES = 30;               // includes system prompt + history
const MAX_CHARS = 12_000;              // rough guardrail to cap context size

function now() {
  return Date.now();
}

function newSession(): SessionState {
  const t = now();
  return {
    messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    createdAt: t,
    lastSeenAt: t,
  };
}

/**
 * Get (or create) a session. Touches lastSeenAt.
 * This is the single "entry point" for session lifecycle.
 */
export function getOrCreateSession(sessionId: SessionId): SessionState {
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.lastSeenAt = now();
    return existing;
  }

  const created = newSession();
  sessions.set(sessionId, created);

  // Persist new session to database
  dbWriteSafe(() => {
    dbCreateSession(sessionId, created.createdAt);
    // Also persist the initial system message
    dbInsertMessage(sessionId, 'system', SYSTEM_PROMPT, 0, created.createdAt);
  }, 'getOrCreateSession');

  return created;
}

/**
 * Returns the message list used for inference.
 * Always includes the system prompt as the first message.
 */
export function getMessages(sessionId: SessionId): ChatMessage[] {
  return getOrCreateSession(sessionId).messages;
}

/**
 * Returns messages for inference with retrieved context injected.
 * Priority: System Prompt → Retrieved Context → Conversation History
 * If retrievedContext is empty, returns normal messages.
 */
export function getMessagesWithRetrievedContext(
  sessionId: SessionId,
  retrievedContext: string
): ChatMessage[] {
  const s = getOrCreateSession(sessionId);

  // If no retrieved context, return normal messages
  if (!retrievedContext.trim()) {
    return s.messages;
  }

  const systemMsg = s.messages[0]; // System prompt (always exists)
  if (!systemMsg) {
    // Shouldn't happen, but handle gracefully
    return s.messages;
  }

  const historyMsgs = s.messages.slice(1); // User/assistant pairs

  const contextMsg: ChatMessage = {
    role: 'system',
    content: retrievedContext,
  };

  const candidateMessages: ChatMessage[] = [systemMsg, contextMsg, ...historyMsgs];

  // Trim to MAX_CHARS (prioritize recent history)
  return trimToMaxChars(candidateMessages, MAX_CHARS);
}

/**
 * Trim messages to fit within maxChars, keeping system messages and recent history.
 */
function trimToMaxChars(msgs: ChatMessage[], maxChars: number): ChatMessage[] {
  const systemMsgs = msgs.filter((m) => m.role === 'system');
  const conversationMsgs = msgs.filter((m) => m.role !== 'system');

  let result = [...systemMsgs];
  let charCount = totalChars(result);

  // Add conversation messages from most recent backwards
  for (let i = conversationMsgs.length - 1; i >= 0; i--) {
    const msg = conversationMsgs[i];
    if (!msg) continue; // Skip if undefined (shouldn't happen)

    if (charCount + msg.content.length <= maxChars) {
      result.splice(systemMsgs.length, 0, msg); // Insert after system messages
      charCount += msg.content.length;
    } else {
      break; // Can't fit more
    }
  }

  return result;
}

export function addUserMessage(sessionId: SessionId, content: string) {
  const s = getOrCreateSession(sessionId);
  const position = s.messages.length;
  s.messages.push({ role: 'user', content });
  trimSession(s, sessionId);

  // Persist to database
  dbWriteSafe(() => {
    dbInsertMessage(sessionId, 'user', content, position, now());
    dbUpdateLastSeen(sessionId, s.lastSeenAt);
  }, 'addUserMessage');
}

export function addAssistantMessage(sessionId: SessionId, content: string) {
  const s = getOrCreateSession(sessionId);
  const position = s.messages.length;
  s.messages.push({ role: 'assistant', content });
  trimSession(s, sessionId);

  // Persist to database
  dbWriteSafe(() => {
    dbInsertMessage(sessionId, 'assistant', content, position, now());
    dbUpdateLastSeen(sessionId, s.lastSeenAt);
  }, 'addAssistantMessage');
}

/**
 * Clears a session's conversation history but keeps the session alive.
 * Useful if you add a "New chat" button on the frontend.
 */
export function resetSession(sessionId: SessionId) {
  const s = getOrCreateSession(sessionId);
  s.messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  s.lastSeenAt = now();

  // Increment reset count in database (messages stay in DB for analytics)
  dbWriteSafe(() => {
    dbIncrementResetCount(sessionId);
  }, 'resetSession');
}

/**
 * Remove sessions that have been inactive longer than TTL.
 * Call from a setInterval in server.ts.
 */
export function cleanupExpiredSessions(): { removed: number; remaining: number } {
  const t = now();
  let removed = 0;
  const expiredIds: string[] = [];

  for (const [id, s] of sessions.entries()) {
    if (t - s.lastSeenAt > SESSION_TTL_MS) {
      sessions.delete(id);
      expiredIds.push(id);
      removed += 1;
    }
  }

  // Mark expired sessions in database (they stay in DB for analytics)
  if (expiredIds.length > 0) {
    dbWriteSafe(() => {
      dbMarkExpired(expiredIds, t);
    }, 'cleanupExpiredSessions');
  }

  return { removed, remaining: sessions.size };
}

/**
 * Optional: basic stats (useful for debugging & analytics later)
 */
export function getSessionCount() {
  return sessions.size;
}

function trimSession(s: SessionState, sessionId: SessionId) {
  // 1) Ensure system message stays at the front
  if (s.messages.length === 0 || s.messages[0]?.role !== 'system') {
    s.messages.unshift({ role: 'system', content: SYSTEM_PROMPT });
  }

  const trimmedPositions: number[] = [];

  // 2) Trim by message count (never remove the system prompt)
  while (s.messages.length > MAX_MESSAGES) {
    // remove the oldest non-system message (position 1)
    trimmedPositions.push(1);
    s.messages.splice(1, 1);
  }

  // 3) Trim by approximate character count (keep system prompt + most recent)
  // This is a simple guardrail; token-based trimming can come later.
  while (totalChars(s.messages) > MAX_CHARS && s.messages.length > 2) {
    trimmedPositions.push(1);
    s.messages.splice(1, 1);
  }

  // Mark trimmed messages in database
  if (trimmedPositions.length > 0) {
    dbWriteSafe(() => {
      dbMarkMessagesTrimmed(sessionId, trimmedPositions);
    }, 'trimSession');
  }
}

function totalChars(msgs: ChatMessage[]) {
  let sum = 0;
  for (const m of msgs) sum += m.content.length;
  return sum;
}
