import pg from 'pg';

import type { Logger } from '../lib/logger/logger.js';

export function createPostgresPool(connectionString: string, logger: Logger): pg.Pool {
  // Without a timeout, a request waits forever when Postgres is unreachable or the pool is full.
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  // Idle clients can emit errors, e.g. on a server restart. Without a listener the process crashes.
  pool.on('error', (error) => {
    logger.error('Postgres pool error', { error });
  });
  return pool;
}
