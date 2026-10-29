import { ApplicationError } from '../lib/errors/application-error.js';
import type { AiProvider } from './ai-provider.js';
import type { GenerationRepository } from './generation-repository.js';
import type { Generation } from './types.js';

const MAX_PROMPT_LENGTH = 2000;
const PROVIDER_TIMEOUT_MS = 3000;

export type ErrorCode = 'invalid_prompt' | 'provider_failed' | 'provider_timeout';

export class InvalidPromptError extends ApplicationError<ErrorCode> {
  constructor(message: string) {
    super('invalid_prompt', message);
  }
}

export class ProviderFailedError extends ApplicationError<ErrorCode> {
  constructor(options?: ErrorOptions) {
    super('provider_failed', 'AI provider failed', options);
  }
}

export class ProviderTimeoutError extends ApplicationError<ErrorCode> {
  constructor() {
    super('provider_timeout', 'AI provider timed out');
  }
}

export class GenerationService {
  constructor(
    private readonly provider: AiProvider,
    private readonly generations: GenerationRepository,
  ) {}

  async createGeneration(userId: string, rawPrompt: unknown): Promise<Generation> {
    const prompt = validatePrompt(rawPrompt);
    const result = await callProviderWithTimeout(this.provider, normalizePrompt(prompt));
    return this.generations.save({ userId, prompt, result, cached: false });
  }
}

function validatePrompt(rawPrompt: unknown): string {
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

// Locale-independent toLowerCase and NFC, so every instance and keyboard builds the same cache key.
function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().normalize('NFC').replace(/\s+/g, ' ');
}

async function callProviderWithTimeout(provider: AiProvider, prompt: string): Promise<string> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      // Reject before aborting, so the provider's abort error cannot win the race and turn into a 502.
      reject(new ProviderTimeoutError());
      controller.abort();
    }, PROVIDER_TIMEOUT_MS);
  });

  try {
    return await Promise.race([provider.generate(prompt, controller.signal), timeout]);
  } catch (error) {
    if (error instanceof ProviderTimeoutError) {
      throw error;
    }
    throw new ProviderFailedError({ cause: error });
  } finally {
    clearTimeout(timer);
  }
}
