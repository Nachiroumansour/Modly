import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

/** Récupère une fiche appartenant au tailleur, sinon 404 (jamais 403 : on ne révèle pas l'existence). */
export async function getOwnedRecord(tailorId: string, recordId: string) {
  const record = await prisma.clientRecord.findFirst({
    where: { id: recordId, tailorId },
  });
  if (!record) {
    throw new ApiError(404, 'INTROUVABLE', 'Fiche client introuvable.');
  }
  return record;
}

/** Valide qu'un userId optionnel référence bien un compte de rôle CLIENT. */
export async function assertLinkedClient(userId: string | undefined): Promise<void> {
  if (!userId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== 'CLIENT') {
    throw new ApiError(400, 'CLIENT_INVALIDE', 'Le compte client lié est invalide.');
  }
}
