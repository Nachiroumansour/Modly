import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { DESIGN_CATEGORIES } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import {
  addReaction,
  designInclude,
  removeReaction,
  toApiDesign,
} from './designs.service.js';

export const designsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const createDesignSchema = z.object({
  title: z.string().min(1, 'Le titre est requis.').max(120),
  description: z.string().max(1000).optional(),
  category: z.enum(DESIGN_CATEGORIES),
});

const feedQuerySchema = z.object({
  category: z.enum(DESIGN_CATEGORIES).optional(),
  search: z.string().min(1).max(80).optional(),
  sort: z.enum(['recent', 'tendance']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

designsRouter.get('/', optionalAuth, async (req, res) => {
  const parsed = feedQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const { category, search, sort, page, limit } = parsed.data;
  const viewerId = req.user?.sub ?? '';
  const where = {
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const orderBy =
    sort === 'tendance'
      ? [{ likesCount: 'desc' as const }, { id: 'desc' as const }]
      : [{ id: 'desc' as const }];
  const rows = await prisma.design.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit + 1,
    include: designInclude(viewerId),
  });
  const hasMore = rows.length > limit;
  res.json({
    designs: rows.slice(0, limit).map(toApiDesign),
    page,
    hasMore,
  });
});

designsRouter.post(
  '/',
  requireAuth,
  requireRole('TAILLEUR'),
  upload.single('image'),
  async (req, res) => {
    const parsed = createDesignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
    }
    if (!req.file) {
      throw new ApiError(400, 'IMAGE_REQUISE', 'Une photo du modèle est requise.');
    }
    if (!ALLOWED_MIMES.includes(req.file.mimetype)) {
      throw new ApiError(
        400,
        'FORMAT_IMAGE_INVALIDE',
        'Formats acceptés : JPEG, PNG ou WebP.',
      );
    }
    const image = await storage.save(req.file.buffer);
    const design = await prisma.design.create({
      data: {
        tailorId: req.user!.sub,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        imageUrl: image.url,
        imageWidth: image.width,
        imageHeight: image.height,
      },
      include: designInclude(req.user!.sub),
    });
    res.status(201).json({ design: toApiDesign(design) });
  },
);

designsRouter.post('/:id/like', requireAuth, async (req, res) => {
  await addReaction('like', req.user!.sub, req.params.id as string);
  res.status(204).send();
});

designsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  await removeReaction('like', req.user!.sub, req.params.id as string);
  res.status(204).send();
});

designsRouter.post('/:id/bookmark', requireAuth, async (req, res) => {
  await addReaction('bookmark', req.user!.sub, req.params.id as string);
  res.status(204).send();
});

designsRouter.delete('/:id/bookmark', requireAuth, async (req, res) => {
  await removeReaction('bookmark', req.user!.sub, req.params.id as string);
  res.status(204).send();
});

designsRouter.get('/:id', optionalAuth, async (req, res) => {
  const viewerId = req.user?.sub ?? '';
  const design = await prisma.design.findUnique({
    where: { id: req.params.id as string },
    include: designInclude(viewerId),
  });
  if (!design) {
    throw new ApiError(404, 'INTROUVABLE', 'Modèle introuvable.');
  }
  const comments = await prisma.comment.findMany({
    where: { designId: design.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json({ design: toApiDesign(design), comments: comments.reverse() });
});
