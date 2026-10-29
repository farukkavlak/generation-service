export interface Generation {
  id: string;
  prompt: string;
  result: string;
  cached: boolean;
  createdAt: Date;
}

export interface NewGeneration {
  userId: string;
  prompt: string;
  result: string;
  cached: boolean;
}

export interface AiProvider {
  // Receives the normalized prompt, so the result depends only on the cache key.
  generate(prompt: string, signal: AbortSignal): Promise<string>;
}

export interface GenerationRepository {
  save(generation: NewGeneration): Promise<Generation>;
}
