import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export const publicUserSelect = { id: true, name: true, avatarUrl: true } as const;

export async function assertTailor(tailorId: string): Promise<void> {
  const t = await prisma.user.findUnique({
    where: { id: tailorId },
    select: { role: true },
  });
  if (!t || t.role !== 'TAILLEUR') {
    throw new ApiError(400, 'TAILLEUR_INVALIDE', 'Le tailleur ciblé est invalide.');
  }
}

/** La commande, si l'utilisateur (client OU tailleur) en est partie prenante. Sinon 404. */
export async function getOwnedOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, OR: [{ clientId: userId }, { tailorId: userId }] },
  });
  if (!order) {
    throw new ApiError(404, 'INTROUVABLE', 'Commande introuvable.');
  }
  return order;
}
