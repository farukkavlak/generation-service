import path from 'node:path';
import { promisify } from 'node:util';

import { loadConfig } from './config.js';
import { createApp } from './http/app.js';
import { runMigrations } from './infra/migrate.js';
import { createPostgresPool } from './infra/postgres.js';
import { createRedisClient } from './infra/redis.js';
import { consoleLogger } from './lib/logger/console-logger.js';

// npm scripts and the Docker image both start the service from the project root.
const MIGRATIONS_DIR = path.resolve('migrations');

const config = loadConfig();
const logger = consoleLogger;

const pool = createPostgresPool(config.databaseUrl, logger);
const redis = createRedisClient(config.redisUrl, logger);

await runMigrations(pool, MIGRATIONS_DIR, logger);

const app = createApp();
const server = app.listen(config.port, (error) => {
  if (error) {
    throw error;
  }
  logger.info('Server started', { port: config.port });
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info('Shutting down', { signal });
  await promisify(server.close.bind(server))();
  // quit() fails while Redis is down and keeps the process alive; a cache has nothing to flush.
  redis.disconnect();
  await pool.end();
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.error('Shutdown failed', { error });
      process.exitCode = 1;
    });
  });
}
