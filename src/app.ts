import express, { type Express } from 'express';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';

import type { AiProvider } from './generations/ai-provider.js';
import { GenerationController } from './generations/generation-controller.js';
import { GenerationRepository } from './generations/generation-repository.js';
import { GenerationService } from './generations/generation-service.js';
import { QuotaRepository } from './generations/quota-repository.js';
import { ResultCache } from './generations/result-cache.js';
import type { Controller } from './http/controller.js';
import { createErrorHandler } from './http/error-handler.js';
import type { Logger } from './lib/logger.js';

// A 2000-char prompt fits even when every char is an escaped surrogate pair (12 bytes each).
const BODY_LIMIT = '32kb';

interface AppDeps {
  pool: Pool;
  redis: Redis;
  provider: AiProvider;
  logger: Logger;
}

export function buildApp({ pool, redis, provider, logger }: AppDeps): Express {
  const generationService = new GenerationService(
    provider,
    new GenerationRepository(pool),
    new QuotaRepository(pool),
    new ResultCache(redis, logger),
  );
  const controllers: Controller[] = [new GenerationController(generationService)];

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: BODY_LIMIT }));
  for (const controller of controllers) {
    app.use(controller.router());
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });
  const errorStatusByCode = new Map(
    controllers.flatMap((controller) => Object.entries(controller.errorStatusByCode)),
  );
  app.use(createErrorHandler(logger, errorStatusByCode));

  return app;
}
