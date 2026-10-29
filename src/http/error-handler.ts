import type { ErrorRequestHandler } from 'express';

import type { Logger } from '../lib/logger/logger.js';

interface ClientError {
  status: number;
  code: string;
}

// express.json() sets the right status on its errors and names the problem in `type`.
const BODY_ERROR_CODES = new Map([
  ['entity.parse.failed', 'invalid_json'],
  ['entity.too.large', 'payload_too_large'],
  ['charset.unsupported', 'unsupported_media_type'],
  ['encoding.unsupported', 'unsupported_media_type'],
]);

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    const clientError = clientErrorOf(error);
    if (!clientError) {
      logger.error('Unhandled error', { method: req.method, path: req.path, error });
    }

    // Once a response has started, only Express can end it safely.
    if (res.headersSent) {
      next(error);
      return;
    }

    if (clientError) {
      res.status(clientError.status).json({ error: clientError.code });
      return;
    }
    res.status(500).json({ error: 'internal_error' });
  };
}

function clientErrorOf(error: unknown): ClientError | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return undefined;
  }
  const { status } = error;
  if (typeof status !== 'number' || status < 400 || status >= 500) {
    return undefined;
  }
  const type = 'type' in error && typeof error.type === 'string' ? error.type : '';
  return { status, code: BODY_ERROR_CODES.get(type) ?? 'bad_request' };
}
