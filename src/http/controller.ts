import type { Router } from 'express';

export interface Controller {
  router(): Router;
  readonly errorStatusByCode: Readonly<Record<string, number>>;
}
