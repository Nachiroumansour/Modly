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
  getForYouFeed,
  getThreadedComments,
  removeReaction,
  getSimilarDesigns,
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
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  following: z.string().optional(),
});

const commentSchema = z.object({
  text: z.string().min(1, 'Le commentaire ne peut pas être vide.').max(500),
  parentId: z.string().optional(),
});

designsRouter.get('/', optionalAuth, async (req, res) => {
  const parsed = feedQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const { category, search, sort, page, limit, cursor, following } = parsed.data;
  const viewerId = req.user?.sub ?? '';
  const isFollowing = following === '1';

  if (isFollowing && !req.user) {
    throw new ApiError(401, 'NON_AUTHENTIFIE', 'Connecte-toi pour voir tes abonnements.');
  }

  const where: Record<string, unknown> = {
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
  if (isFollowing) {
    const follows = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { tailorId: true },
    });
    where.tailorId = { in: follows.map((f) => f.tailorId) };
  }

  if (page !== undefined) {
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
    res.json({ designs: rows.slice(0, limit).map(toApiDesign), page, hasMore });
    return;
  }

  // Feed « Pour toi » personnalisé : par défaut (sans filtre), pour un viewer
  // connecté qui a des centres d'intérêt, on met en avant ses catégories.
  if (!category && !search && !isFollowing && req.user) {
    const me = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { interests: true },
    });
    if (me && me.interests.length > 0) {
      res.json(await getForYouFeed({ viewerId, interests: me.interests, limit, cursor }));
      return;
    }
  }

  const rows = await prisma.design.findMany({
    where,
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: designInclude(viewerId),
  });
  const nextCursor = rows.length > limit ? rows[limit - 1].id : null;
  res.json({ designs: rows.slice(0, limit).map(toApiDesign), nextCursor });
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
    parsed.data.parentId,
  );
  res.status(201).json({ comment });
});

designsRouter.get('/:id/comments', optionalAuth, async (req, res) => {
  await ensureDesignExists(req.params.id as string);
  res.json({ comments: await getThreadedComments(req.params.id as string, req.user?.sub ?? '') });
});

designsRouter.get('/:id/similar', optionalAuth, async (req, res) => {
  const raw = Number(req.query.limit);
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 12, 1), 30);
  const viewerId = req.user?.sub ?? '';
  const designs = await getSimilarDesigns(req.params.id as string, viewerId, limit);
  res.json({ designs });
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
