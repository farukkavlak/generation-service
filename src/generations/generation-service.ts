import { ApplicationError } from '../lib/application-error.js';
import type { AiProvider } from './ai-provider.js';
import type { Generation, HistoryCursor } from './generation.js';
import type { GenerationRepository } from './generation-repository.js';
import type { QuotaRepository } from './quota-repository.js';
import type { ResultCache } from './result-cache.js';

const MAX_PROMPT_LENGTH = 2000;
const PROVIDER_TIMEOUT_MS = 3000;
const DAILY_QUOTA_LIMIT = 5;
const TIMED_OUT = Symbol('timed out');
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CURSOR_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// 18 digits always fit in a Postgres bigint.
const CURSOR_ID = /^\d{1,18}$/;

export type GenerationErrorCode =
  | 'invalid_prompt'
  | 'invalid_limit'
  | 'invalid_cursor'
  | 'quota_exceeded'
  | 'provider_failed'
  | 'provider_timeout';

interface CreatedGeneration {
  generation: Generation;
  quotaRemaining: number;
}

interface HistoryPage {
  items: Generation[];
  nextCursor: string | null;
}

class InvalidPromptError extends ApplicationError {
  constructor(message: string) {
    super('invalid_prompt' satisfies GenerationErrorCode, message);
  }
}

class InvalidLimitError extends ApplicationError {
  constructor() {
    super(
      'invalid_limit' satisfies GenerationErrorCode,
      `limit must be an integer from 1 to ${String(MAX_PAGE_SIZE)}`,
    );
  }
}

class InvalidCursorError extends ApplicationError {
  constructor() {
    super('invalid_cursor' satisfies GenerationErrorCode, 'cursor is invalid');
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
    private readonly cache: ResultCache,
  ) {}

  async createGeneration(userId: string, rawPrompt: unknown): Promise<CreatedGeneration> {
    const prompt = parsePrompt(rawPrompt);
    const normalizedPrompt = normalizePrompt(prompt);

    const cachedResult = await this.cache.find(normalizedPrompt);
    if (cachedResult !== undefined) {
      const generation = await this.generations.save({
        userId,
        prompt,
        result: cachedResult,
        cached: true,
      });
      return { generation, quotaRemaining: await this.getQuotaRemaining(userId) };
    }

    const reservation = await this.quota.reserve(userId, DAILY_QUOTA_LIMIT);
    if (!reservation) {
      throw new QuotaExceededError();
    }

    let result: string | typeof TIMED_OUT;
    try {
      result = await callProviderWithTimeout(this.provider, normalizedPrompt);
    } catch (error) {
      const quotaRemaining = await this.releaseQuota(userId, reservation.day);
      throw new ProviderFailedError(quotaRemaining, { cause: error });
    }
    if (result === TIMED_OUT) {
      const quotaRemaining = await this.releaseQuota(userId, reservation.day);
      throw new ProviderTimeoutError(quotaRemaining);
    }

    await this.cache.save(normalizedPrompt, result);
    const generation = await this.generations.save({ userId, prompt, result, cached: false });
    return { generation, quotaRemaining: DAILY_QUOTA_LIMIT - reservation.used };
  }

  async getHistoryPage(
    userId: string,
    rawLimit: unknown,
    rawCursor: unknown,
  ): Promise<HistoryPage> {
    const limit = parseLimit(rawLimit);
    const after = rawCursor === undefined ? undefined : decodeCursor(rawCursor);
    // One extra row tells whether a next page exists.
    const rows = await this.generations.findPage(userId, limit + 1, after);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
  }

  async getQuotaRemaining(userId: string): Promise<number> {
    const used = await this.quota.findUsedToday(userId);
    return DAILY_QUOTA_LIMIT - used;
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

function parseLimit(rawLimit: unknown): number {
  if (rawLimit === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  if (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit)) {
    throw new InvalidLimitError();
  }
  const limit = Number(rawLimit);
  if (limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new InvalidLimitError();
  }
  return limit;
}

function decodeCursor(rawCursor: unknown): HistoryCursor {
  if (typeof rawCursor !== 'string') {
    throw new InvalidCursorError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursorError();
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('createdAt' in parsed) ||
    !('id' in parsed)
  ) {
    throw new InvalidCursorError();
  }
  const { createdAt, id } = parsed;
  if (
    typeof createdAt !== 'string' ||
    !CURSOR_DATE.test(createdAt) ||
    typeof id !== 'string' ||
    !CURSOR_ID.test(id)
  ) {
    throw new InvalidCursorError();
  }
  const date = new Date(createdAt);
  // Round trip rejects dates that Date silently rolls over, like Feb 30.
  if (Number.isNaN(date.getTime()) || date.toISOString() !== createdAt) {
    throw new InvalidCursorError();
  }
  return { createdAt, id };
}

function encodeCursor(generation: Generation): string {
  const cursor = { createdAt: generation.createdAt.toISOString(), id: generation.id };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}
