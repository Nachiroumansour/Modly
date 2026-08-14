import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { measurementSchema } from '../client-records/client-records.service.js';
import { designInclude, ensureDesignExists, toApiDesign } from '../designs/designs.service.js';

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

usersRouter.patch('/me/bookmarks/:designId', requireAuth, async (req, res) => {
  const parsed = z.object({ collectionId: z.string().nullable() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', 'Collection invalide.');
  const userId = req.user!.sub;
  const designId = req.params.designId as string;
  await ensureDesignExists(designId);
  if (parsed.data.collectionId) {
    const col = await prisma.collection.findFirst({
      where: { id: parsed.data.collectionId, userId },
    });
    if (!col) throw new ApiError(404, 'INTROUVABLE', 'Collection introuvable.');
  }
  const existing = await prisma.bookmark.findUnique({
    where: { userId_designId: { userId, designId } },
  });
  if (existing) {
    await prisma.bookmark.update({
      where: { id: existing.id },
      data: { collectionId: parsed.data.collectionId },
    });
  } else {
    await prisma.$transaction([
      prisma.bookmark.create({ data: { userId, designId, collectionId: parsed.data.collectionId } }),
      prisma.design.update({ where: { id: designId }, data: { bookmarksCount: { increment: 1 } } }),
    ]);
  }
  res.status(204).send();
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

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

usersRouter.post(
  '/me/photos',
  requireAuth,
  requireRole('TAILLEUR'),
  photoUpload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const avatarFile = files?.avatar?.[0];
    const coverFile = files?.cover?.[0];
    if (!avatarFile && !coverFile) {
      throw new ApiError(400, 'IMAGE_REQUISE', 'Ajoute au moins une photo.');
    }
    for (const f of [avatarFile, coverFile]) {
      if (f && !PHOTO_MIMES.includes(f.mimetype)) {
        throw new ApiError(400, 'FORMAT_IMAGE_INVALIDE', 'Formats acceptés : JPEG, PNG ou WebP.');
      }
    }

    const userId = req.user!.sub;
    if (avatarFile) {
      const saved = await storage.save(avatarFile.buffer);
      await prisma.user.update({ where: { id: userId }, data: { avatarUrl: saved.url } });
    }
    if (coverFile) {
      const saved = await storage.save(coverFile.buffer);
      await prisma.tailorProfile.upsert({
        where: { userId },
        create: { userId, coverUrl: saved.url },
        update: { coverUrl: saved.url },
      });
    }

    // Renvoyer l'état à jour (au cas où un seul des deux a été fourni).
    const fresh = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, tailorProfile: { select: { coverUrl: true } } },
    });
    res.json({
      avatarUrl: fresh?.avatarUrl ?? null,
      coverUrl: fresh?.tailorProfile?.coverUrl ?? null,
    });
  },
);

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
