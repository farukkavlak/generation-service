import type { Pool } from 'pg';

interface QuotaReservation {
  // Kept as 'YYYY-MM-DD' text: pg would turn a date into a local-time Date and shift the day.
  day: string;
  used: number;
}

export class QuotaRepository {
  constructor(private readonly pool: Pool) {}

  async reserve(userId: string, limit: number): Promise<QuotaReservation | undefined> {
    const { rows } = await this.pool.query<QuotaReservation>(
      `INSERT INTO daily_quota (user_id, day, used)
       VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET used = daily_quota.used + 1
       WHERE daily_quota.used < $2
       RETURNING day::text AS day, used`,
      [userId, limit],
    );
    return rows[0];
  }

  async findUsedToday(userId: string): Promise<number> {
    const { rows } = await this.pool.query<{ used: number }>(
      `SELECT used FROM daily_quota
       WHERE user_id = $1 AND day = (now() AT TIME ZONE 'UTC')::date`,
      [userId],
    );
    return rows[0]?.used ?? 0;
  }

  async release(userId: string, day: string): Promise<number> {
    const { rows } = await this.pool.query<{ used: number }>(
      `UPDATE daily_quota SET used = used - 1
       WHERE user_id = $1 AND day = $2 AND used > 0
       RETURNING used`,
      [userId, day],
    );
    const [row] = rows;
    if (!row) {
      throw new Error('No quota reservation to release');
    }
    return row.used;
  }
}
