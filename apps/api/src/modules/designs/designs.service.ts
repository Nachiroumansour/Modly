import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export const publicUserSelect = { id: true, name: true, avatarUrl: true } as const;

export function designInclude(viewerId: string) {
  return {
    tailor: { select: publicUserSelect },
    likes: { where: { userId: viewerId }, select: { id: true } },
    bookmarks: { where: { userId: viewerId }, select: { id: true } },
  } as const;
}

type DesignWithViewer = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
  createdAt: Date;
  tailor: { id: string; name: string; avatarUrl: string | null };
  likes: { id: string }[];
  bookmarks: { id: string }[];
};

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
