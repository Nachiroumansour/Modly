import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { designInclude, toApiDesign } from '../designs/designs.service.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      avatarUrl: true,
      email: true,
      createdAt: true,
      tailorProfile: true,
    },
  });
  if (!user) {
    throw new ApiError(401, 'NON_AUTHENTIFIE', 'Compte introuvable.');
  }
  res.json({ user });
});

usersRouter.get('/me/bookmarks', requireAuth, async (req, res) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
    include: { design: { include: designInclude(req.user!.sub) } },
  });
  res.json({ designs: bookmarks.map((b) => toApiDesign(b.design)) });
});
