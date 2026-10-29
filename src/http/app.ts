import express, { type Express, type Router } from 'express';

import type { Logger } from '../lib/logger.js';
import { createErrorHandler } from './error-handler.js';

// A 2000-char prompt fits even when every char is an escaped surrogate pair (12 bytes each).
const BODY_LIMIT = '32kb';

export interface Controller {
  router(): Router;
  readonly errorStatusByCode: Readonly<Record<string, number>>;
}

interface AppDeps {
  logger: Logger;
  controllers: Controller[];
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: BODY_LIMIT }));
  for (const controller of deps.controllers) {
    app.use(controller.router());
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });
  const errorStatusByCode = new Map(
    deps.controllers.flatMap((controller) => Object.entries(controller.errorStatusByCode)),
  );
  app.use(createErrorHandler(deps.logger, errorStatusByCode));

  return app;
}
