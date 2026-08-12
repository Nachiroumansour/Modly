import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

async function getComment(commentId: string) {
  const c = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { design: { select: { id: true, tailorId: true } } },
  });
  if (!c) throw new ApiError(404, 'INTROUVABLE', 'Commentaire introuvable.');
  return c;
}

export async function likeComment(userId: string, commentId: string) {
  await getComment(commentId);
  try {
    await prisma.$transaction([
      prisma.commentLike.create({ data: { userId, commentId } }),
      prisma.comment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 } } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    throw err;
  }
}

export async function unlikeComment(userId: string, commentId: string) {
  const deleted = await prisma.commentLike.deleteMany({ where: { userId, commentId } });
  if (deleted.count > 0) {
    await prisma.comment.update({ where: { id: commentId }, data: { likesCount: { decrement: 1 } } });
  }
}

export async function deleteComment(userId: string, commentId: string) {
  const c = await getComment(commentId);
  if (c.userId !== userId) throw new ApiError(404, 'INTROUVABLE', 'Commentaire introuvable.');
  const replies = await prisma.comment.count({ where: { parentId: commentId } });
  await prisma.$transaction([
    prisma.comment.delete({ where: { id: commentId } }),
    prisma.design.update({
      where: { id: c.designId },
      data: { commentsCount: { decrement: 1 + replies } },
    }),
  ]);
}

export async function pinComment(userId: string, commentId: string, pinned: boolean) {
  const c = await getComment(commentId);
  if (c.design.tailorId !== userId) throw new ApiError(404, 'INTROUVABLE', 'Commentaire introuvable.');
  if (pinned) {
    await prisma.comment.updateMany({
      where: { designId: c.designId, pinned: true },
      data: { pinned: false },
    });
  }
  await prisma.comment.update({ where: { id: commentId }, data: { pinned } });
}
