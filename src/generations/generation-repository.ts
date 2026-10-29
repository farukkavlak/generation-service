import type { Pool } from 'pg';

import type { Generation, NewGeneration } from './types.js';

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
       RETURNING id, prompt, result, cached, created_at`,
      [generation.userId, generation.prompt, generation.result, generation.cached],
    );
    const [row] = rows;
    if (!row) {
      throw new Error('Insert returned no row');
    }
    return toGeneration(row);
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
