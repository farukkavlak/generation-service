import express, { type Express } from 'express';

import type { Logger } from '../lib/logger/logger.js';
import { createErrorHandler } from './error-handler.js';

// A 2000-char prompt fits even when every char is JSON-escaped (6 bytes each).
const BODY_LIMIT = '16kb';

interface AppDeps {
  logger: Logger;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: BODY_LIMIT }));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });
  app.use(createErrorHandler(deps.logger));

  return app;
}
