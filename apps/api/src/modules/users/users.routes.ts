import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

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
