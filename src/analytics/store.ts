// src/analytics/store.ts
export type Role = 'user' | 'assistant';

export type LoggedMessage = {
  role: Role;
  content: string;
  at: number;       // unix ms
  wordCount: number;
};

export type TurnLog = {
  sessionId: string;
  turnId: string;

  user: LoggedMessage;
  assistant: LoggedMessage;

  latencyMs: number;

  // Context snapshot right before inference (includes system + history + the new user msg)
  contextWordCount: number;
};

const turnsBySession = new Map<string, TurnLog[]>();

export function logTurn(turn: TurnLog) {
  const list = turnsBySession.get(turn.sessionId) ?? [];
  list.push(turn);
  turnsBySession.set(turn.sessionId, list);
}

export function getTurns(sessionId: string): TurnLog[] {
  return turnsBySession.get(sessionId) ?? [];
}

export function getTurnCount(sessionId: string): number {
  return getTurns(sessionId).length;
}

export function wordCount(text: string): number {
  // Simple, robust approximation:
  // split on whitespace and remove empties
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function contextWordCountFromMessages(messages: { content: string }[]): number {
  let total = 0;
  for (const m of messages) total += wordCount(m.content);
  return total;
}

export function newTurnId(): string {
  // Good enough for in-memory analytics.
  // If you later want stable IDs, use crypto.randomUUID().
  return `turn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
