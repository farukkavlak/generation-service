import { setTimeout as sleep } from 'node:timers/promises';

import type { AiProvider } from '../generations/ai-provider.js';

const RESPONSE_DELAY_MS = 300;
const SLOW_DELAY_MS = 2000;
const TIMEOUT_DELAY_MS = 30_000;

export function createFakeAiProvider(): AiProvider {
  return {
    async generate(prompt, signal) {
      await sleep(delayFor(prompt), undefined, { signal });
      if (prompt.startsWith('error')) {
        throw new Error('Fake provider failed');
      }
      return `Sonuç: ${prompt}`;
    },
  };
}

function delayFor(prompt: string): number {
  if (prompt.startsWith('timeout')) {
    return TIMEOUT_DELAY_MS;
  }
  if (prompt.startsWith('slow')) {
    return SLOW_DELAY_MS;
  }
  return RESPONSE_DELAY_MS;
}
