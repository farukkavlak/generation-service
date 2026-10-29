import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Pool, PoolClient } from 'pg';

import type { Logger } from '../lib/logger.js';

const MIGRATION_LOCK_ID = 7_250_001;

export async function runMigrations(
  pool: Pool,
  migrationsDir: string,
  logger: Logger,
): Promise<void> {
  const client = await pool.connect();
  try {
    // Migrations may run long and may wait for another instance's lock.
    await client.query('SET statement_timeout = 0');
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await createMigrationsTable(client);

    for (const name of await findPendingMigrations(client, migrationsDir)) {
      await applyMigration(client, migrationsDir, name);
      logger.info('Migration applied', { name });
    }
  } finally {
    // Closing the session frees the lock and rolls back an open transaction.
    client.release(true);
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
