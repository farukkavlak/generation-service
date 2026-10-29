import { ApplicationError } from '../lib/errors/application-error.js';
import type { AiProvider, Generation, GenerationRepository } from './types.js';

const MAX_PROMPT_LENGTH = 2000;
const PROVIDER_TIMEOUT_MS = 3000;

export enum ErrorCode {
  InvalidPrompt = 'invalid_prompt',
  ProviderFailed = 'provider_failed',
  ProviderTimeout = 'provider_timeout',
}

export class InvalidPromptError extends ApplicationError<ErrorCode> {
  constructor(message: string) {
    super(ErrorCode.InvalidPrompt, message);
  }
}

export class ProviderFailedError extends ApplicationError<ErrorCode> {
  constructor(options?: ErrorOptions) {
    super(ErrorCode.ProviderFailed, 'AI provider failed', options);
  }
}

export class ProviderTimeoutError extends ApplicationError<ErrorCode> {
  constructor() {
    super(ErrorCode.ProviderTimeout, 'AI provider timed out');
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

// toLowerCase is locale independent on purpose: every instance must build the same cache key.
function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().normalize('NFC').replace(/\s+/g, ' ');
}

async function callProviderWithTimeout(provider: AiProvider, prompt: string): Promise<string> {
  const signal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
  try {
    // Also race the signal, so a provider that ignores it still cannot run past the timeout.
    return await Promise.race([provider.generate(prompt, signal), rejectOnAbort(signal)]);
  } catch (error) {
    // Providers may throw any error type when aborted, so the signal decides.
    if (signal.aborted) {
      throw new ProviderTimeoutError();
    }
    throw new ProviderFailedError({ cause: error });
  }
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(new ProviderTimeoutError());
      },
      { once: true },
    );
  });
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
