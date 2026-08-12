import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { designInclude, toApiDesign } from '../designs/designs.service.js';

export async function listCollections(userId: string) {
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { bookmarks: true } },
      bookmarks: {
        take: 4,
        orderBy: { createdAt: 'desc' },
        include: { design: { select: { imageUrl: true } } },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    count: c._count.bookmarks,
    covers: c.bookmarks.map((b) => b.design.imageUrl),
  }));
}

export async function createCollection(userId: string, name: string) {
  try {
    return await prisma.collection.create({ data: { userId, name } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'NOM_DEJA_UTILISE', 'Tu as déjà une collection avec ce nom.');
    }
    throw err;
  }
}

export async function getOwnedCollection(userId: string, id: string) {
  const c = await prisma.collection.findFirst({ where: { id, userId } });
  if (!c) throw new ApiError(404, 'INTROUVABLE', 'Collection introuvable.');
  return c;
}

export async function renameCollection(userId: string, id: string, name: string) {
  await getOwnedCollection(userId, id);
  try {
    return await prisma.collection.update({ where: { id }, data: { name } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'NOM_DEJA_UTILISE', 'Tu as déjà une collection avec ce nom.');
    }
    throw err;
  }
}

export async function deleteCollection(userId: string, id: string) {
  await getOwnedCollection(userId, id);
  await prisma.collection.delete({ where: { id } });
}

export async function getCollectionDesigns(userId: string, id: string) {
  const collection = await getOwnedCollection(userId, id);
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId, collectionId: id },
    orderBy: { createdAt: 'desc' },
    include: { design: { include: designInclude(userId) } },
  });
  return {
    collection: { id: collection.id, name: collection.name },
    designs: bookmarks.map((b) => toApiDesign(b.design)),
  };
}
