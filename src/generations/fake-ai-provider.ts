import { setTimeout as sleep } from 'node:timers/promises';

import type { AiProvider } from './ai-provider.js';

const DEFAULT_DELAY_MS = 300;
const SLOW_DELAY_MS = 2000;
const HANG_DELAY_MS = 30_000;

export class FakeAiProvider implements AiProvider {
  async generate(prompt: string, signal: AbortSignal): Promise<string> {
    await sleep(delayFor(prompt), undefined, { signal });
    if (prompt.startsWith('error')) {
      throw new Error('Fake provider failed');
    }
    return `Sonuç: ${prompt}`;
  }
}

function delayFor(prompt: string): number {
  if (prompt.startsWith('timeout')) {
    return HANG_DELAY_MS;
  }
  if (prompt.startsWith('slow')) {
    return SLOW_DELAY_MS;
  }
  return DEFAULT_DELAY_MS;
}
