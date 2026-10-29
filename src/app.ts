import type { Express } from 'express';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';

import type { AiProvider } from './generations/ai-provider.js';
import { GenerationController } from './generations/generation-controller.js';
import { GenerationRepository } from './generations/generation-repository.js';
import { GenerationService } from './generations/generation-service.js';
import { QuotaRepository } from './generations/quota-repository.js';
import { ResultCache } from './generations/result-cache.js';
import { createApp } from './http/app.js';
import type { Logger } from './lib/logger.js';

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
  return createApp({ logger, controllers: [new GenerationController(generationService)] });
}
