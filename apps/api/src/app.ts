import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './lib/errors.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { clientRecordsRouter } from './modules/client-records/client-records.routes.js';
import { designsRouter } from './modules/designs/designs.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { tailorsRouter } from './modules/tailors/tailors.routes.js';
import { collectionsRouter } from './modules/collections/collections.routes.js';
import { commentsRouter } from './modules/comments/comments.routes.js';
import { notificationsRouter, pushTokensRouter } from './modules/notifications/notifications.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/uploads',
    express.static(path.resolve(process.env.UPLOADS_DIR ?? './uploads')),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/me/collections', collectionsRouter);
  app.use('/me/notifications', notificationsRouter);
  app.use('/me/push-tokens', pushTokensRouter);
  app.use(usersRouter);
  app.use('/designs', designsRouter);
  app.use('/comments', commentsRouter);
  app.use('/tailors', tailorsRouter);
  app.use('/client-records', clientRecordsRouter);
  app.use('/orders', ordersRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'INTROUVABLE', message: 'Ressource introuvable.' },
    });
  });

  app.use(errorHandler);
  return app;
}
