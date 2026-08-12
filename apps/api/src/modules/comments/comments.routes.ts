import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { deleteComment, likeComment, pinComment, unlikeComment } from './comments.service.js';

export const commentsRouter = Router();

commentsRouter.post('/:id/like', requireAuth, async (req, res) => {
  await likeComment(req.user!.sub, req.params.id as string);
  res.status(204).send();
});

commentsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  await unlikeComment(req.user!.sub, req.params.id as string);
  res.status(204).send();
});

commentsRouter.delete('/:id', requireAuth, async (req, res) => {
  await deleteComment(req.user!.sub, req.params.id as string);
  res.status(204).send();
});

commentsRouter.patch('/:id/pin', requireAuth, async (req, res) => {
  const parsed = z.object({ pinned: z.boolean() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', 'Valeur invalide.');
  await pinComment(req.user!.sub, req.params.id as string, parsed.data.pinned);
  res.status(204).send();
});
