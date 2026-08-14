import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { ensureReportTargetExists } from './reports.service.js';

export const reportsRouter = Router();

const reportSchema = z.object({
  targetType: z.enum(['DESIGN', 'COMMENT', 'USER']),
  targetId: z.string().min(1),
  reason: z.enum(['INAPPROPRIE', 'SPAM', 'PLAGIAT', 'HARCELEMENT', 'AUTRE']),
  details: z.string().max(500).optional(),
});

reportsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const { targetType, targetId, reason, details } = parsed.data;
  const reporterId = req.user!.sub;
  if (targetType === 'USER' && targetId === reporterId) {
    throw new ApiError(400, 'ACTION_INVALIDE', 'Tu ne peux pas te signaler toi-même.');
  }
  await ensureReportTargetExists(targetType, targetId);
  try {
    const report = await prisma.report.create({
      data: { reporterId, targetType, targetId, reason, details },
    });
    res.status(201).json({ report });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const report = await prisma.report.findUnique({
        where: { reporterId_targetType_targetId: { reporterId, targetType, targetId } },
      });
      res.status(200).json({ report, alreadyReported: true });
      return;
    }
    throw err;
  }
});
