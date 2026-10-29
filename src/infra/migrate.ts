import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Pool, PoolClient } from 'pg';

import type { Logger } from '../lib/logger/logger.js';

// Any fixed number; every instance must use the same one.
const MIGRATION_LOCK_ID = 7_250_001;

export async function runMigrations(
  pool: Pool,
  migrationsDir: string,
  logger: Logger,
): Promise<void> {
  const client = await pool.connect();
  try {
    // Instances may start together; the lock makes them migrate one at a time.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await createMigrationsTable(client);

    for (const name of await findPendingMigrations(client, migrationsDir)) {
      await applyMigration(client, migrationsDir, name);
      logger.info('Migration applied', { name });
    }

    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    client.release();
  } catch (error) {
    // Closing the session rolls back the open transaction and frees the lock.
    client.release(true);
    throw error;
  }
}

async function createMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function findPendingMigrations(client: PoolClient, migrationsDir: string): Promise<string[]> {
  const applied = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  const names = await readdir(migrationsDir);
  return names.filter((name) => name.endsWith('.sql') && !appliedNames.has(name)).sort();
}

async function applyMigration(
  client: PoolClient,
  migrationsDir: string,
  name: string,
): Promise<void> {
  const sql = await readFile(join(migrationsDir, name), 'utf8');
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
  await client.query('COMMIT');
}
