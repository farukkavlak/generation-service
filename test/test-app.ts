import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { inject } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AiProvider } from '../src/generations/ai-provider.js';
import { createPostgresPool } from '../src/infra/postgres.js';
import { createRedisClient } from '../src/infra/redis.js';
import { silentLogger } from './silent-logger.js';

interface TestResponse {
  status: number;
  quotaRemaining: string | null;
  body: unknown;
}

interface StartOptions {
  redisDown?: boolean;
  providerTimeoutMs?: number;
}

export class TestApp {
  private constructor(
    readonly pool: Pool,
    private readonly redis: Redis,
    private readonly server: Server,
  ) {}

  static async start(provider: AiProvider, options: StartOptions = {}): Promise<TestApp> {
    const pool = createPostgresPool(inject('databaseUrl'), silentLogger);
    const redis = createRedisClient(inject('redisUrl'), silentLogger);
    await once(redis, 'ready');
    if (options.redisDown) {
      redis.disconnect();
    }
    const app = buildApp({
      pool,
      redis,
      provider,
      logger: silentLogger,
      providerTimeoutMs: options.providerTimeoutMs,
    });
    const server = await new Promise<Server>((resolve) => {
      const started = app.listen(0, () => {
        resolve(started);
      });
    });
    return new TestApp(pool, redis, server);
  }

  postGeneration(userId: string, prompt: string): Promise<TestResponse> {
    return this.request('POST', '/v1/generations', userId, { prompt });
  }

  get(path: string, userId: string): Promise<TestResponse> {
    return this.request('GET', path, userId);
  }

  async reset(): Promise<void> {
    await this.pool.query('TRUNCATE generations, daily_quota');
    await this.redis.flushdb();
  }

  async stop(): Promise<void> {
    await new Promise((resolve) => this.server.close(resolve));
    this.redis.disconnect();
    await this.pool.end();
  }

  private async request(
    method: string,
    path: string,
    userId: string,
    body?: unknown,
  ): Promise<TestResponse> {
    const { port } = this.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-user-id': userId },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      quotaRemaining: response.headers.get('x-quota-remaining'),
      body: (await response.json()) as unknown,
    };
  }
}
