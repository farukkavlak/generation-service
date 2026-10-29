import { ApplicationError } from '../lib/application-error.js';
import type { AiProvider } from './ai-provider.js';
import type { Generation } from './generation.js';
import type { GenerationRepository } from './generation-repository.js';
import type { QuotaRepository } from './quota-repository.js';

const MAX_PROMPT_LENGTH = 2000;
const PROVIDER_TIMEOUT_MS = 3000;
const DAILY_QUOTA_LIMIT = 5;
const TIMED_OUT = Symbol('timed out');

export type GenerationErrorCode =
  'invalid_prompt' | 'quota_exceeded' | 'provider_failed' | 'provider_timeout';

interface CreatedGeneration {
  generation: Generation;
  quotaRemaining: number;
}

class InvalidPromptError extends ApplicationError {
  constructor(message: string) {
    super('invalid_prompt' satisfies GenerationErrorCode, message);
  }
}

export class ErrorWithQuotaRemaining extends ApplicationError {
  constructor(
    code: GenerationErrorCode,
    message: string,
    readonly quotaRemaining: number,
    options?: ErrorOptions,
  ) {
    super(code, message, options);
  }
}

class QuotaExceededError extends ErrorWithQuotaRemaining {
  constructor() {
    super('quota_exceeded', 'Daily quota exceeded', 0);
  }
}

class ProviderFailedError extends ErrorWithQuotaRemaining {
  constructor(quotaRemaining: number, options?: ErrorOptions) {
    super('provider_failed', 'AI provider failed', quotaRemaining, options);
  }
}

class ProviderTimeoutError extends ErrorWithQuotaRemaining {
  constructor(quotaRemaining: number) {
    super('provider_timeout', 'AI provider timed out', quotaRemaining);
  }
}

export class GenerationService {
  constructor(
    private readonly provider: AiProvider,
    private readonly generations: GenerationRepository,
    private readonly quota: QuotaRepository,
  ) {}

  async createGeneration(userId: string, rawPrompt: unknown): Promise<CreatedGeneration> {
    const prompt = parsePrompt(rawPrompt);
    const reservation = await this.quota.reserve(userId, DAILY_QUOTA_LIMIT);
    if (!reservation) {
      throw new QuotaExceededError();
    }

    let result: string | typeof TIMED_OUT;
    try {
      result = await callProviderWithTimeout(this.provider, normalizePrompt(prompt));
    } catch (error) {
      const quotaRemaining = await this.releaseQuota(userId, reservation.day);
      throw new ProviderFailedError(quotaRemaining, { cause: error });
    }
    if (result === TIMED_OUT) {
      const quotaRemaining = await this.releaseQuota(userId, reservation.day);
      throw new ProviderTimeoutError(quotaRemaining);
    }

    const generation = await this.generations.save({ userId, prompt, result, cached: false });
    return { generation, quotaRemaining: DAILY_QUOTA_LIMIT - reservation.used };
  }

  private async releaseQuota(userId: string, day: string): Promise<number> {
    const used = await this.quota.release(userId, day);
    return DAILY_QUOTA_LIMIT - used;
  }
}

function parsePrompt(rawPrompt: unknown): string {
  if (typeof rawPrompt !== 'string') {
    throw new InvalidPromptError('prompt must be a string');
  }
  const prompt = rawPrompt.trim();
  if (prompt.length === 0) {
    throw new InvalidPromptError('prompt must not be empty');
  }
  // Count code points, not UTF-16 units, to match Postgres char_length.
  if (Array.from(prompt).length > MAX_PROMPT_LENGTH) {
    throw new InvalidPromptError(`prompt must be at most ${String(MAX_PROMPT_LENGTH)} characters`);
  }
  // Postgres text cannot store the NUL character.
  if (prompt.includes('\u0000')) {
    throw new InvalidPromptError('prompt must not contain NUL characters');
  }
  return prompt;
}

// NFC, so composed and decomposed forms of the same text share one cache key.
function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().normalize('NFC').replace(/\s+/g, ' ');
}

async function callProviderWithTimeout(
  provider: AiProvider,
  prompt: string,
): Promise<string | typeof TIMED_OUT> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => {
      // Resolve before aborting, so the provider's abort error cannot win the race and turn into a 502.
      resolve(TIMED_OUT);
      controller.abort();
    }, PROVIDER_TIMEOUT_MS);
  });

  try {
    return await Promise.race([provider.generate(prompt, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
