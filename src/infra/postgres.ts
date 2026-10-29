import pg from 'pg';

import type { Logger } from '../lib/logger.js';

export function createPostgresPool(connectionString: string, logger: Logger): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    // pg parses dates only in ISO DateStyle; pin it so server defaults cannot break parsing.
    options: '-c DateStyle=ISO -c TimeZone=UTC',
  });
  // Idle clients can emit errors, e.g. on a server restart. Without a listener the process crashes.
  pool.on('error', (error) => {
    logger.error('Postgres pool error', { error });
  });
  return pool;
}
