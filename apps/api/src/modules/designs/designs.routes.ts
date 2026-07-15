import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { DESIGN_CATEGORIES } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import {
  addComment,
  addReaction,
  designInclude,
  ensureDesignExists,
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

const commentSchema = z.object({
  text: z.string().min(1, 'Le commentaire ne peut pas être vide.').max(500),
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
  upload.array('media', 5),
  async (req, res) => {
    const parsed = createDesignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw new ApiError(400, 'IMAGE_REQUISE', 'Ajoute au moins une photo du modèle.');
    }
    if (files.length > 5) {
      throw new ApiError(400, 'TROP_IMAGES', 'Maximum 5 images par modèle.');
    }
    for (const f of files) {
      if (!ALLOWED_MIMES.includes(f.mimetype)) {
        throw new ApiError(400, 'FORMAT_IMAGE_INVALIDE', 'Formats acceptés : JPEG, PNG ou WebP.');
      }
    }

    const stored = await Promise.all(files.map((f) => storage.save(f.buffer)));
    const cover = stored[0]!;

    const design = await prisma.design.create({
      data: {
        tailorId: req.user!.sub,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        imageUrl: cover.url,
        imageWidth: cover.width,
        imageHeight: cover.height,
        coverBlurhash: cover.blurhash,
        mediaCount: stored.length,
        media: {
          create: stored.map((s, i) => ({
            type: 'IMAGE' as const,
            url: s.url,
            width: s.width,
            height: s.height,
            blurhash: s.blurhash,
            position: i,
          })),
        },
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

designsRouter.post('/:id/comments', requireAuth, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const comment = await addComment(
    req.user!.sub,
    req.params.id as string,
    parsed.data.text,
  );
  res.status(201).json({ comment });
});

designsRouter.get('/:id/comments', async (req, res) => {
  await ensureDesignExists(req.params.id as string);
  const comments = await prisma.comment.findMany({
    where: { designId: req.params.id as string },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json({ comments });
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
