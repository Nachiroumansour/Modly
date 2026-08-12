import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  createCollection,
  deleteCollection,
  getCollectionDesigns,
  listCollections,
  renameCollection,
} from './collections.service.js';

export const collectionsRouter = Router();

const nameSchema = z.object({ name: z.string().trim().min(1, 'Donne un nom.').max(40) });

collectionsRouter.get('/', requireAuth, async (req, res) => {
  res.json({ collections: await listCollections(req.user!.sub) });
});

collectionsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  const collection = await createCollection(req.user!.sub, parsed.data.name);
  res.status(201).json({ collection });
});

collectionsRouter.get('/:id', requireAuth, async (req, res) => {
  res.json(await getCollectionDesigns(req.user!.sub, req.params.id as string));
});

collectionsRouter.patch('/:id', requireAuth, async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  const collection = await renameCollection(req.user!.sub, req.params.id as string, parsed.data.name);
  res.json({ collection });
});

collectionsRouter.delete('/:id', requireAuth, async (req, res) => {
  await deleteCollection(req.user!.sub, req.params.id as string);
  res.status(204).send();
});
