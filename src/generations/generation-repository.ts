import type { Pool } from 'pg';

import type { Generation, HistoryCursor, NewGeneration } from './generation.js';

const GENERATION_COLUMNS = 'id, prompt, result, cached, created_at';

interface GenerationRow {
  // bigint stays a string: it can exceed Number.MAX_SAFE_INTEGER.
  id: string;
  prompt: string;
  result: string;
  cached: boolean;
  created_at: Date;
}

export class GenerationRepository {
  constructor(private readonly pool: Pool) {}

  async save(generation: NewGeneration): Promise<Generation> {
    const { rows } = await this.pool.query<GenerationRow>(
      `INSERT INTO generations (user_id, prompt, result, cached)
       VALUES ($1, $2, $3, $4)
       RETURNING ${GENERATION_COLUMNS}`,
      [generation.userId, generation.prompt, generation.result, generation.cached],
    );
    const [row] = rows;
    if (!row) {
      throw new Error('Insert returned no row');
    }
    return toGeneration(row);
  }

  // Page by (created_at, id), not id: created_at is the transaction start, so id order can differ.
  async findPage(userId: string, limit: number, after?: HistoryCursor): Promise<Generation[]> {
    const { rows } = after
      ? await this.pool.query<GenerationRow>(
          `SELECT ${GENERATION_COLUMNS} FROM generations
           WHERE user_id = $1 AND (created_at, id) < ($2, $3)
           ORDER BY created_at DESC, id DESC
           LIMIT $4`,
          [userId, after.createdAt, after.id, limit],
        )
      : await this.pool.query<GenerationRow>(
          `SELECT ${GENERATION_COLUMNS} FROM generations
           WHERE user_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT $2`,
          [userId, limit],
        );
    return rows.map(toGeneration);
  }
}

function toGeneration(row: GenerationRow): Generation {
  return {
    id: row.id,
    prompt: row.prompt,
    result: row.result,
    cached: row.cached,
    createdAt: row.created_at,
  };
}
