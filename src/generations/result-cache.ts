import type { Redis } from 'ioredis';

import type { Logger } from '../lib/logger.js';

const KEY_PREFIX = 'generation-result:';
const TTL_SECONDS = 600;

// Fails open: Redis errors count as a miss so requests keep working.
export class ResultCache {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async find(normalizedPrompt: string): Promise<string | undefined> {
    try {
      const result = await this.redis.get(KEY_PREFIX + normalizedPrompt);
      return result ?? undefined;
    } catch (error) {
      this.logger.error('Result cache read failed', { error });
      return undefined;
    }
  }

  async save(normalizedPrompt: string, result: string): Promise<void> {
    try {
      await this.redis.set(KEY_PREFIX + normalizedPrompt, result, 'EX', TTL_SECONDS);
    } catch (error) {
      this.logger.error('Result cache write failed', { error });
    }
  }
}
