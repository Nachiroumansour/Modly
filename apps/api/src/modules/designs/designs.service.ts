import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export const publicUserSelect = { id: true, name: true, avatarUrl: true } as const;

export function designInclude(viewerId: string) {
  return {
    tailor: { select: publicUserSelect },
    likes: { where: { userId: viewerId }, select: { id: true } },
    bookmarks: { where: { userId: viewerId }, select: { id: true } },
  } satisfies Prisma.DesignInclude;
}

type DesignWithViewer = Prisma.DesignGetPayload<{
  include: ReturnType<typeof designInclude>;
}>;

export function toApiDesign(design: DesignWithViewer) {
  const { likes, bookmarks, ...rest } = design;
  return { ...rest, likedByMe: likes.length > 0, bookmarkedByMe: bookmarks.length > 0 };
}

export async function ensureDesignExists(designId: string): Promise<void> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: { id: true },
  });
  if (!design) {
    throw new ApiError(404, 'INTROUVABLE', 'Modèle introuvable.');
  }
}

type ReactionKind = 'like' | 'bookmark';

function counterData(kind: ReactionKind, delta: 1 | -1) {
  const op = delta === 1 ? { increment: 1 } : { decrement: 1 };
  return kind === 'like' ? { likesCount: op } : { bookmarksCount: op };
}

export async function addReaction(
  kind: ReactionKind,
  userId: string,
  designId: string,
): Promise<void> {
  await ensureDesignExists(designId);
  const create =
    kind === 'like'
      ? prisma.like.create({ data: { userId, designId } })
      : prisma.bookmark.create({ data: { userId, designId } });
  try {
    await prisma.$transaction([
      create,
      prisma.design.update({
        where: { id: designId },
        data: counterData(kind, 1),
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return; // Déjà fait : idempotent, pas de double comptage.
    }
    throw err;
  }
}

export async function removeReaction(
  kind: ReactionKind,
  userId: string,
  designId: string,
): Promise<void> {
  await ensureDesignExists(designId);
  const deleted =
    kind === 'like'
      ? await prisma.like.deleteMany({ where: { userId, designId } })
      : await prisma.bookmark.deleteMany({ where: { userId, designId } });
  if (deleted.count > 0) {
    await prisma.design.update({
      where: { id: designId },
      data: counterData(kind, -1),
    });
  }
}

export async function addComment(userId: string, designId: string, text: string) {
  await ensureDesignExists(designId);
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { userId, designId, text },
      include: { user: { select: publicUserSelect } },
    }),
    prisma.design.update({
      where: { id: designId },
      data: { commentsCount: { increment: 1 } },
    }),
  ]);
  return comment;
}
