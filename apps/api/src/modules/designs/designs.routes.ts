import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { DESIGN_CATEGORIES } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { designInclude, toApiDesign } from './designs.service.js';

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

designsRouter.get('/:id', optionalAuth, async (req, res) => {
  const viewerId = req.user?.sub ?? '';
  const design = await prisma.design.findUnique({
    where: { id: req.params.id },
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
