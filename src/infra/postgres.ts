import pg from 'pg';

import type { Logger } from '../lib/logger/logger.js';

export function createPostgresPool(connectionString: string, logger: Logger): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  // Idle clients can emit errors, e.g. on a server restart. Without a listener the process crashes.
  pool.on('error', (error) => {
    logger.error('Postgres pool error', { error });
  });
  return pool;
}
