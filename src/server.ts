import type { Server } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';

import type { Express } from 'express';

import { loadConfig } from './config.js';
import { createApp } from './http/app.js';
import { runMigrations } from './infra/migrate.js';
import { createPostgresPool } from './infra/postgres.js';
import { createRedisClient } from './infra/redis.js';
import { consoleLogger as logger } from './lib/logger/console-logger.js';

const MIGRATIONS_DIR = path.resolve('migrations');

main().catch((error: unknown) => {
  logger.error('Service stopped with an error', { error });
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPostgresPool(config.databaseUrl, logger);
  const redis = createRedisClient(config.redisUrl, logger);

  try {
    await runMigrations(pool, MIGRATIONS_DIR, logger);
    const server = await listen(createApp({ logger }), config.port);
    logger.info('Server started', { port: config.port });

    const signal = await shutdownSignal();
    logger.info('Shutting down', { signal });
    await promisify(server.close.bind(server))();
  } finally {
    // quit() fails while Redis is down and keeps the process alive; a cache has nothing to flush.
    redis.disconnect();
    await pool.end();
  }
}

function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(server);
      }
    });
  });
}

function shutdownSignal(): Promise<NodeJS.Signals> {
  return new Promise((resolve) => {
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.once(signal, () => {
        resolve(signal);
      });
    }
  });
}
