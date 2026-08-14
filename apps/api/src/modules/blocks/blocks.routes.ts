import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const blocksRouter = Router();

blocksRouter.get('/me/blocks', requireAuth, async (req, res) => {
  const rows = await prisma.block.findMany({
    where: { blockerId: req.user!.sub },
    select: { blockedId: true },
  });
  res.json({ blockedIds: rows.map((r) => r.blockedId) });
});

blocksRouter.post('/users/:id/block', requireAuth, async (req, res) => {
  const blockedId = req.params.id as string;
  const blockerId = req.user!.sub;
  if (blockedId === blockerId) {
    throw new ApiError(400, 'ACTION_INVALIDE', 'Tu ne peux pas te bloquer toi-même.');
  }
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) throw new ApiError(404, 'INTROUVABLE', 'Utilisateur introuvable.');
  try {
    await prisma.block.create({ data: { blockerId, blockedId } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    // Déjà bloqué : idempotent.
  }
  // Couper les follows dans les deux sens.
  await prisma.follow.deleteMany({
    where: {
      OR: [
        { followerId: blockerId, tailorId: blockedId },
        { followerId: blockedId, tailorId: blockerId },
      ],
    },
  });
  res.status(204).send();
});

blocksRouter.delete('/users/:id/block', requireAuth, async (req, res) => {
  await prisma.block.deleteMany({
    where: { blockerId: req.user!.sub, blockedId: req.params.id as string },
  });
  res.status(204).send();
});
