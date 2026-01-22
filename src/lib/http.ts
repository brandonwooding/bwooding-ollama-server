import { z, ZodError, type ZodType } from 'zod';

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Parse and validate unknown input (like request.body).
 * If invalid, throw an HttpError(400) with useful details.
 */
export function parseBody<T>(schema: ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpError(400, 'Invalid request body', z.flattenError(err));
    }
    throw err;
  }
}
