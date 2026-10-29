import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TestAiProvider } from './test-ai-provider.js';
import { TestApp } from './test-app.js';

const USER_ID = 'user-1';

describe('POST /v1/generations', () => {
  const provider = new TestAiProvider();
  let app: TestApp;

  beforeAll(async () => {
    app = await TestApp.start(provider);
  });

  beforeEach(async () => {
    provider.reset();
    await app.reset();
  });

  afterAll(async () => {
    await app.stop();
  });

  it('allows exactly 5 of 10 concurrent requests from one user', async () => {
    provider.holdAnswers();
    const requests = Array.from({ length: 10 }, (_, index) =>
      app.postGeneration(USER_ID, `prompt ${String(index)}`),
    );
    // Five requests now hold a quota slot inside the provider.
    await vi.waitFor(
      () => {
        expect(provider.prompts).toHaveLength(5);
      },
      { timeout: 5000 },
    );
    provider.releaseAnswers();

    const statuses = (await Promise.all(requests)).map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
    expect(provider.prompts).toHaveLength(5);
    expect(await countGenerations(app, USER_ID)).toBe(5);
  });

  it('serves a differently written prompt from the cache', async () => {
    const first = await app.postGeneration(USER_ID, 'merhaba dünya');
    const second = await app.postGeneration(USER_ID, '  MERHABA   dünya ');

    expect(first).toMatchObject({ status: 201, quotaRemaining: '4', body: { cached: false } });
    expect(second).toMatchObject({
      status: 201,
      quotaRemaining: '4',
      body: { prompt: 'MERHABA   dünya', result: 'Sonuç: merhaba dünya', cached: true },
    });
    expect(provider.prompts).toEqual(['merhaba dünya']);
    expect(await app.get('/v1/quota', USER_ID)).toMatchObject({ body: { remaining: 4 } });
    expect(await countGenerations(app, USER_ID)).toBe(2);
  });

  it('serves cached results after the quota is used up', async () => {
    for (const prompt of ['a', 'b', 'c', 'd', 'e']) {
      await app.postGeneration(USER_ID, prompt);
    }

    expect(await app.postGeneration(USER_ID, 'f')).toMatchObject({
      status: 429,
      quotaRemaining: '0',
      body: { error: 'quota_exceeded' },
    });
    expect(await app.postGeneration(USER_ID, 'A')).toMatchObject({
      status: 201,
      body: { cached: true },
    });
    expect(provider.prompts).toHaveLength(5);
  });

  it('does not count a failed provider call', async () => {
    provider.failWith(new Error('provider down'));

    expect(await app.postGeneration(USER_ID, 'merhaba')).toMatchObject({
      status: 502,
      quotaRemaining: '5',
      body: { error: 'provider_failed' },
    });
    expect(await app.get('/v1/quota', USER_ID)).toMatchObject({ body: { remaining: 5 } });
    expect(await countGenerations(app, USER_ID)).toBe(0);
  });

  it('does not count or cache a provider timeout', async () => {
    const appWithShortTimeout = await TestApp.start(provider, { providerTimeoutMs: 100 });
    try {
      provider.holdAnswers();
      expect(await appWithShortTimeout.postGeneration(USER_ID, 'merhaba')).toMatchObject({
        status: 504,
        quotaRemaining: '5',
        body: { error: 'provider_timeout' },
      });
      expect(provider.signals.map((signal) => signal.aborted)).toEqual([true]);
      expect(await app.get('/v1/quota', USER_ID)).toMatchObject({ body: { remaining: 5 } });
      expect(await countGenerations(app, USER_ID)).toBe(0);

      provider.releaseAnswers();
      expect(await app.postGeneration(USER_ID, 'merhaba')).toMatchObject({
        status: 201,
        body: { cached: false },
      });
    } finally {
      await appWithShortTimeout.stop();
    }
  });

  it('keeps serving requests while Redis is down', async () => {
    const appWithoutRedis = await TestApp.start(provider, { redisDown: true });
    try {
      const first = await appWithoutRedis.postGeneration(USER_ID, 'merhaba');
      const second = await appWithoutRedis.postGeneration(USER_ID, 'merhaba');

      expect(first).toMatchObject({ status: 201, body: { cached: false } });
      expect(second).toMatchObject({ status: 201, quotaRemaining: '3', body: { cached: false } });
      expect(provider.prompts).toHaveLength(2);
    } finally {
      await appWithoutRedis.stop();
    }
  });
});

async function countGenerations(app: TestApp, userId: string): Promise<number> {
  const { rows } = await app.pool.query<{ count: string }>(
    'SELECT count(*) FROM generations WHERE user_id = $1',
    [userId],
  );
  return Number(rows[0]?.count);
}
