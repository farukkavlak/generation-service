import type { Request } from 'express';

import { ApplicationError } from '../lib/errors/application-error.js';

// Matches the user_id CHECK in the database.
const MAX_USER_ID_LENGTH = 128;

export class UnauthorizedError extends ApplicationError {
  constructor() {
    super('unauthorized', 'X-User-Id header is missing or invalid');
  }
}

export function requireUserId(req: Request): string {
  const userId = req.get('X-User-Id')?.trim();
  if (!userId || userId.length > MAX_USER_ID_LENGTH) {
    throw new UnauthorizedError();
  }
  return userId;
}
