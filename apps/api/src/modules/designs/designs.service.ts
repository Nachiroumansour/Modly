import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export const publicUserSelect = { id: true, name: true, avatarUrl: true } as const;

export function designInclude(viewerId: string) {
  return {
    tailor: { select: publicUserSelect },
    likes: { where: { userId: viewerId }, select: { id: true } },
    bookmarks: { where: { userId: viewerId }, select: { id: true } },
    media: { orderBy: { position: 'asc' as const } },
  } satisfies Prisma.DesignInclude;
}

type DesignWithViewer = Prisma.DesignGetPayload<{
  include: ReturnType<typeof designInclude>;
}>;

export function toApiDesign(design: DesignWithViewer) {
  const { likes, bookmarks, media, ...rest } = design;
  return {
    ...rest,
    media: media.map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      width: m.width,
      height: m.height,
      duration: m.duration,
      blurhash: m.blurhash,
      position: m.position,
    })),
    likedByMe: likes.length > 0,
    bookmarkedByMe: bookmarks.length > 0,
  };
}

export async function getSimilarDesigns(designId: string, viewerId: string, limit: number) {
  const current = await prisma.design.findUnique({
    where: { id: designId },
    select: { id: true, tailorId: true, category: true },
  });
  if (!current) {
    throw new ApiError(404, 'INTROUVABLE', 'Modèle introuvable.');
  }
  const sameTailor = await prisma.design.findMany({
    where: { tailorId: current.tailorId, id: { not: current.id } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: designInclude(viewerId),
  });
  const excludeIds = [current.id, ...sameTailor.map((d) => d.id)];
  const remaining = limit - sameTailor.length;
  const sameCategory =
    remaining > 0
      ? await prisma.design.findMany({
          where: { category: current.category, id: { notIn: excludeIds } },
          orderBy: { createdAt: 'desc' },
          take: remaining,
          include: designInclude(viewerId),
        })
      : [];
  return [...sameTailor, ...sameCategory].map(toApiDesign);
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

type CommentWithRels = {
  id: string;
  text: string;
  createdAt: Date;
  parentId: string | null;
  pinned: boolean;
  likesCount: number;
  user: { id: string; name: string; avatarUrl: string | null };
  likes: { id: string }[];
  replies?: CommentWithRels[];
};

export type ApiComment = {
  id: string;
  text: string;
  createdAt: Date;
  parentId: string | null;
  pinned: boolean;
  likesCount: number;
  likedByMe: boolean;
  user: { id: string; name: string; avatarUrl: string | null };
  replies: ApiComment[];
};

export function toApiComment(c: CommentWithRels): ApiComment {
  return {
    id: c.id,
    text: c.text,
    createdAt: c.createdAt,
    parentId: c.parentId,
    pinned: c.pinned,
    likesCount: c.likesCount,
    likedByMe: c.likes.length > 0,
    user: c.user,
    replies: (c.replies ?? []).map(toApiComment),
  };
}

export async function addComment(userId: string, designId: string, text: string, parentId?: string) {
  await ensureDesignExists(designId);
  if (parentId) {
    const parent = await prisma.comment.findFirst({ where: { id: parentId, designId } });
    if (!parent || parent.parentId) {
      throw new ApiError(400, 'REPONSE_INVALIDE', 'Réponse invalide.');
    }
  }
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { userId, designId, text, parentId: parentId ?? null },
      include: {
        user: { select: publicUserSelect },
        likes: { where: { userId }, select: { id: true } },
      },
    }),
    prisma.design.update({ where: { id: designId }, data: { commentsCount: { increment: 1 } } }),
  ]);
  return toApiComment({ ...comment, replies: [] });
}

export async function getThreadedComments(designId: string, viewerId: string) {
  const roots = await prisma.comment.findMany({
    where: { designId, parentId: null },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'asc' }],
    take: 200,
    include: {
      user: { select: publicUserSelect },
      likes: { where: { userId: viewerId }, select: { id: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: publicUserSelect },
          likes: { where: { userId: viewerId }, select: { id: true } },
        },
      },
    },
  });
  return roots.map((r) => toApiComment(r));
}
