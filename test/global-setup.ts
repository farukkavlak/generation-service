import path from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';

import { runMigrations } from '../src/infra/migrate.js';
import { createPostgresPool } from '../src/infra/postgres.js';
import { silentLogger } from './silent-logger.js';

// Same images as docker-compose.yml.
const POSTGRES_IMAGE = 'postgres:16.15-alpine';
const REDIS_IMAGE = 'redis:7.4-alpine';
const MIGRATIONS_DIR = path.join(import.meta.dirname, '..', 'migrations');

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).start(),
    new RedisContainer(REDIS_IMAGE).start(),
  ]);

  const pool = createPostgresPool(postgres.getConnectionUri(), silentLogger);
  try {
    await runMigrations(pool, MIGRATIONS_DIR, silentLogger);
  } finally {
    await pool.end();
  }

  project.provide('databaseUrl', postgres.getConnectionUri());
  project.provide('redisUrl', redis.getConnectionUrl());

  return async () => {
    await Promise.all([postgres.stop(), redis.stop()]);
  };
}
