import { prisma } from '../../lib/prisma.js';

/** Ids en relation de blocage avec le viewer, dans les deux sens (vide si non connecté). */
export async function getBlockedUserIds(viewerId: string): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.blockerId === viewerId ? r.blockedId : r.blockerId);
  return [...ids];
}
