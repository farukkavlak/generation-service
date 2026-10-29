import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { TestAiProvider } from './test-ai-provider.js';
import { TestApp } from './test-app.js';

const USER_ID = 'user-1';

interface HistoryPage {
  items: { id: string; prompt: string }[];
  nextCursor: string | null;
}

describe('GET /v1/generations', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await TestApp.start(new TestAiProvider());
  });

  beforeEach(async () => {
    await app.reset();
  });

  afterAll(async () => {
    await app.stop();
  });

  it('pages through equal timestamps without losing or repeating rows', async () => {
    await app.pool.query(
      `INSERT INTO generations (user_id, prompt, result, cached, created_at)
       SELECT $1, 'prompt ' || n, 'result', false, '2026-01-01T10:00:00.000Z'
       FROM generate_series(1, 5) AS n`,
      [USER_ID],
    );
    await app.pool.query(
      `INSERT INTO generations (user_id, prompt, result, cached, created_at)
       VALUES ('user-2', 'other user', 'result', false, '2026-01-01T10:00:00.000Z')`,
    );

    const prompts: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor ? `?limit=2&cursor=${cursor}` : '?limit=2';
      const response = await app.get(`/v1/generations${query}`, USER_ID);
      expect(response.status).toBe(200);
      const page = response.body as HistoryPage;
      prompts.push(...page.items.map((item) => item.prompt));
      cursor = page.nextCursor;
    } while (cursor);

    expect(prompts).toEqual(['prompt 5', 'prompt 4', 'prompt 3', 'prompt 2', 'prompt 1']);
  });

  it('rejects an invalid limit', async () => {
    const response = await app.get('/v1/generations?limit=101', USER_ID);

    expect(response).toMatchObject({ status: 400, body: { error: 'invalid_limit' } });
  });
});
