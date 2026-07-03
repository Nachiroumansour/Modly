import cors from 'cors';
import express from 'express';
import { errorHandler } from './lib/errors.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'INTROUVABLE', message: 'Ressource introuvable.' },
    });
  });

  app.use(errorHandler);
  return app;
}
