import type { ErrorRequestHandler } from 'express';

import { ApplicationError } from '../lib/application-error.js';
import type { Logger } from '../lib/logger.js';
import { UnauthorizedError } from './require-user-id.js';

interface ErrorStatus {
  status: number;
  code: string;
}

// express.json() errors carry their HTTP status and name the problem in `type`.
const BODY_ERROR_CODES = new Map([
  ['entity.parse.failed', 'invalid_json'],
  ['entity.too.large', 'payload_too_large'],
  ['charset.unsupported', 'unsupported_media_type'],
  ['encoding.unsupported', 'unsupported_media_type'],
]);

export function createErrorHandler(
  logger: Logger,
  errorStatusByCode: ReadonlyMap<string, number>,
): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    const errorStatus = toErrorStatus(error, errorStatusByCode);
    if (!errorStatus || errorStatus.status >= 500) {
      logger.error('Request failed', { method: req.method, path: req.path, error });
    }

    if (res.headersSent) {
      next(error);
      return;
    }

    const { status, code } = errorStatus ?? { status: 500, code: 'internal_error' };
    res.status(status).json({ error: code });
  };
}

function toErrorStatus(
  error: unknown,
  errorStatusByCode: ReadonlyMap<string, number>,
): ErrorStatus | undefined {
  if (error instanceof UnauthorizedError) {
    return { status: 401, code: error.code };
  }
  if (error instanceof ApplicationError) {
    const status = errorStatusByCode.get(error.code);
    return status === undefined ? undefined : { status, code: error.code };
  }
  if (!isClientHttpError(error)) {
    return undefined;
  }
  const type = 'type' in error && typeof error.type === 'string' ? error.type : '';
  return { status: error.status, code: BODY_ERROR_CODES.get(type) ?? 'bad_request' };
}

// http-errors sets `expose` only on 4xx errors that are safe to show to the client.
function isClientHttpError(error: unknown): error is { status: number; expose: true } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'expose' in error &&
    error.expose === true &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status < 500
  );
}
