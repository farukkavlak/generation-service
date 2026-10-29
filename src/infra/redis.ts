import { Redis } from 'ioredis';

import type { Logger } from '../lib/logger.js';

export function createRedisClient(url: string, logger: Logger): Redis {
  // Fail fast while Redis is down or hung, so callers can treat it as a cache miss.
  const redis = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    commandTimeout: 500,
    connectTimeout: 2000,
  });
  redis.on('error', (error) => {
    logger.error('Redis error', { error });
  });
  return redis;
}
