import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { designInclude, toApiDesign } from '../designs/designs.service.js';
import { createNotification } from '../notifications/notifications.service.js';

export const tailorsRouter = Router();

async function ensureTailorExists(tailorId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: tailorId },
    select: { role: true },
  });
  if (!target || target.role !== 'TAILLEUR') {
    throw new ApiError(404, 'INTROUVABLE', 'Tailleur introuvable.');
  }
}

tailorsRouter.post('/:id/follow', requireAuth, async (req, res) => {
  const tailorId = req.params.id as string;
  if (tailorId === req.user!.sub) {
    throw new ApiError(400, 'ACTION_INVALIDE', 'Tu ne peux pas te suivre toi-même.');
  }
  await ensureTailorExists(tailorId);
  try {
    await prisma.follow.create({ data: { followerId: req.user!.sub, tailorId } });
    await createNotification({
      recipientId: tailorId,
      actorId: req.user!.sub,
      type: 'FOLLOW',
      groupKey: 'follow',
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
      throw err;
    }
    // Déjà suivi : idempotent.
  }
  res.status(204).send();
});

tailorsRouter.delete('/:id/follow', requireAuth, async (req, res) => {
  const tailorId = req.params.id as string;
  await ensureTailorExists(tailorId);
  await prisma.follow.deleteMany({
    where: { followerId: req.user!.sub, tailorId },
  });
  res.status(204).send();
});

tailorsRouter.get('/:id', optionalAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id as string },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      tailorProfile: true,
      _count: { select: { followers: true, designs: true } },
    },
  });
  if (!user || user.role !== 'TAILLEUR') {
    throw new ApiError(404, 'INTROUVABLE', 'Tailleur introuvable.');
  }
  const viewerId = req.user?.sub ?? '';
  const designs = await prisma.design.findMany({
    where: { tailorId: user.id },
    orderBy: { id: 'desc' },
    take: 20,
    include: designInclude(viewerId),
  });
  const followedByMe = viewerId
    ? (await prisma.follow.findUnique({
        where: { followerId_tailorId: { followerId: viewerId, tailorId: user.id } },
      })) !== null
    : false;
  res.json({
    tailor: {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      profile: user.tailorProfile,
      followersCount: user._count.followers,
      designsCount: user._count.designs,
    },
    designs: designs.map(toApiDesign),
    followedByMe,
  });
});
