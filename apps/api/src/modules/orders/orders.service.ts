import { MEASUREMENT_FIELDS, ORDER_STATUSES, type OrderStatus } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export const publicUserSelect = { id: true, name: true, avatarUrl: true } as const;

// Ordre de production (sans ANNULEE, statut terminal transverse).
const CHAINE = ORDER_STATUSES.filter((s) => s !== 'ANNULEE');

/** Valide une transition de production : avance seule, annulation permise, terminaux verrouillés. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === 'LIVREE' || from === 'ANNULEE') {
    throw new ApiError(409, 'TRANSITION_INVALIDE', 'Cette commande est terminée.');
  }
  if (to === 'ANNULEE') return; // annulation permise depuis tout statut non terminal
  if (CHAINE.indexOf(to) <= CHAINE.indexOf(from)) {
    throw new ApiError(409, 'TRANSITION_INVALIDE', 'On ne peut pas revenir en arrière.');
  }
}

/**
 * Vérifie que la fiche appartient au tailleur et renvoie le snapshot (dernière mesure)
 * à figer sur la commande. `null` si la fiche n'a encore aucune mesure.
 */
export async function snapshotFromRecord(
  tailorId: string,
  clientRecordId: string,
): Promise<Record<string, number> | null> {
  const record = await prisma.clientRecord.findFirst({
    where: { id: clientRecordId, tailorId },
    select: { id: true },
  });
  if (!record) {
    throw new ApiError(400, 'FICHE_INVALIDE', 'La fiche client liée est invalide.');
  }
  const latest = await prisma.measurement.findFirst({
    where: { clientRecordId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) return null;
  return Object.fromEntries(
    MEASUREMENT_FIELDS.map((f) => [f.key, latest[f.key as keyof typeof latest]]).filter(
      ([, v]) => v != null,
    ),
  ) as Record<string, number>;
}

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
