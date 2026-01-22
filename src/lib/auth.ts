import { HttpError } from './http.js';

export function requireApiKey(headers: Record<string, unknown>) {
  const expected = process.env.API_KEY;
  if (!expected) return; // if not set, auth is off (useful during early dev)

  const received = String(headers['x-api-key'] ?? '');
  if (received !== expected) {
    throw new HttpError(401, 'Unauthorized');
  }
}
