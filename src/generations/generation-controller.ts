import { type Request, Router } from 'express';

import type { Controller } from '../http/controller.js';
import { requireUserId } from '../http/require-user-id.js';
import type { Generation } from './generation.js';
import {
  ErrorWithQuotaRemaining,
  type GenerationErrorCode,
  type GenerationService,
} from './generation-service.js';

const QUOTA_REMAINING_HEADER = 'X-Quota-Remaining';

export class GenerationController implements Controller {
  readonly errorStatusByCode: Readonly<Record<GenerationErrorCode, number>> = {
    invalid_prompt: 400,
    invalid_limit: 400,
    invalid_cursor: 400,
    quota_exceeded: 429,
    provider_failed: 502,
    provider_timeout: 504,
  };

  constructor(private readonly service: GenerationService) {}

  router(): Router {
    const router = Router();

    router.post('/v1/generations', async (req, res) => {
      const userId = requireUserId(req);
      try {
        const { generation, quotaRemaining } = await this.service.createGeneration(
          userId,
          readPrompt(req),
        );
        res.set(QUOTA_REMAINING_HEADER, String(quotaRemaining));
        res.status(201).json(toResponse(generation));
      } catch (error) {
        if (error instanceof ErrorWithQuotaRemaining) {
          res.set(QUOTA_REMAINING_HEADER, String(error.quotaRemaining));
        }
        throw error;
      }
    });

    router.get('/v1/generations', async (req, res) => {
      const userId = requireUserId(req);
      const page = await this.service.getHistoryPage(userId, req.query.limit, req.query.cursor);
      res.json({ items: page.items.map(toResponse), nextCursor: page.nextCursor });
    });

    router.get('/v1/quota', async (req, res) => {
      const userId = requireUserId(req);
      const remaining = await this.service.getQuotaRemaining(userId);
      res.json({ remaining });
    });

    return router;
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
