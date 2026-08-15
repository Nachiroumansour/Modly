import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export type ReportTargetType = 'DESIGN' | 'COMMENT' | 'USER';

/** Vérifie que la cible d'un signalement existe, sinon 404. */
export async function ensureReportTargetExists(type: ReportTargetType, id: string): Promise<void> {
  const exists =
    type === 'DESIGN'
      ? await prisma.design.findUnique({ where: { id }, select: { id: true } })
      : type === 'COMMENT'
        ? await prisma.comment.findUnique({ where: { id }, select: { id: true } })
        : await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    throw new ApiError(404, 'INTROUVABLE', 'Contenu introuvable.');
  }
}
