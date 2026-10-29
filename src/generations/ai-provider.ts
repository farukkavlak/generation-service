export interface AiProvider {
  // Receives the normalized prompt, so the result depends only on the cache key.
  generate(prompt: string, signal: AbortSignal): Promise<string>;
}
