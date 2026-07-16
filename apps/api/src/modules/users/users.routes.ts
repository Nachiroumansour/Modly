import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { measurementSchema } from '../client-records/client-records.service.js';
import { designInclude, toApiDesign } from '../designs/designs.service.js';

export const usersRouter = Router();

const profileSchema = z
  .object({
    bio: z.string().max(500).optional(),
    location: z.string().max(120).optional(),
    specialties: z.array(z.string().min(1).max(40)).max(10).optional(),
    yearsExperience: z.number().int().min(0).max(80).optional(),
    priceMin: z.number().int().min(0).optional(),
    priceMax: z.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Aucune donnée à modifier.',
  })
  .refine(
    (d) => d.priceMin == null || d.priceMax == null || d.priceMin <= d.priceMax,
    { message: 'Le prix minimum doit être inférieur au prix maximum.' },
  );

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

usersRouter.patch('/me/profile', requireAuth, requireRole('TAILLEUR'), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const profile = await prisma.tailorProfile.update({
    where: { userId: req.user!.sub },
    data: parsed.data,
  });
  res.json({ profile });
});

usersRouter.get('/me/measurements', requireAuth, requireRole('CLIENT'), async (req, res) => {
  const records = await prisma.clientRecord.findMany({
    where: { userId: req.user!.sub },
    orderBy: { updatedAt: 'desc' },
    include: {
      tailor: { select: { id: true, name: true, avatarUrl: true } },
      measurements: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  res.json({
    records: records.map((r) => ({
      id: r.id,
      tailor: r.tailor,
      latestMeasurement: r.measurements[0] ?? null,
    })),
  });
});

usersRouter.get('/me/self-measurement', requireAuth, requireRole('CLIENT'), async (req, res) => {
  const measurement = await prisma.selfMeasurement.findUnique({ where: { userId: req.user!.sub } });
  res.json({ measurement });
});

usersRouter.put('/me/self-measurement', requireAuth, requireRole('CLIENT'), async (req, res) => {
  const parsed = measurementSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const measurement = await prisma.selfMeasurement.upsert({
    where: { userId: req.user!.sub },
    create: { userId: req.user!.sub, ...parsed.data },
    update: parsed.data,
  });
  res.json({ measurement });
});
