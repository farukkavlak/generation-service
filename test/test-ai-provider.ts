import type { AiProvider } from '../src/generations/ai-provider.js';

export class TestAiProvider implements AiProvider {
  readonly prompts: string[] = [];
  readonly signals: AbortSignal[] = [];
  private failure: Error | undefined;
  private held: Promise<void> = Promise.resolve();
  private releaseHeld = (): void => {};

  async generate(prompt: string, signal: AbortSignal): Promise<string> {
    this.prompts.push(prompt);
    this.signals.push(signal);
    await this.held;
    if (this.failure) {
      throw this.failure;
    }
    return `Sonuç: ${prompt}`;
  }

  failWith(error: Error): void {
    this.failure = error;
  }

  holdAnswers(): void {
    this.held = new Promise((resolve) => {
      this.releaseHeld = resolve;
    });
  }

  releaseAnswers(): void {
    this.releaseHeld();
  }

  reset(): void {
    this.prompts.length = 0;
    this.signals.length = 0;
    this.failure = undefined;
    this.releaseAnswers();
    this.held = Promise.resolve();
  }
}
