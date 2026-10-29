import express, { type Express } from 'express';

// A 2000-char prompt fits even when every char is JSON-escaped (6 bytes each).
const BODY_LIMIT = '16kb';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: BODY_LIMIT }));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  return app;
}
