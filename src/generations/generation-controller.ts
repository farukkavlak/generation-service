import { type Request, Router } from 'express';

import type { Controller } from '../http/app.js';
import { requireUserId } from '../http/require-user-id.js';
import type { Generation } from './generation.js';
import type { GenerationErrorCode, GenerationService } from './generation-service.js';

export class GenerationController implements Controller {
  readonly errorStatusByCode: Readonly<Record<GenerationErrorCode, number>> = {
    invalid_prompt: 400,
    provider_failed: 502,
    provider_timeout: 504,
  };

  constructor(private readonly service: GenerationService) {}

  router(): Router {
    return Router().post('/v1/generations', async (req, res) => {
      const userId = requireUserId(req);
      const generation = await this.service.createGeneration(userId, readPrompt(req));
      res.status(201).json(toResponse(generation));
    });
  }
}

// req.body is undefined unless the request is JSON, and JSON may be an array.
function readPrompt(req: Request): unknown {
  const body: unknown = req.body;
  return typeof body === 'object' && body !== null && 'prompt' in body ? body.prompt : undefined;
}

function toResponse(generation: Generation) {
  return {
    id: generation.id,
    prompt: generation.prompt,
    result: generation.result,
    cached: generation.cached,
    createdAt: generation.createdAt.toISOString(),
  };
}
