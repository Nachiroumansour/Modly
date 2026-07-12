import { ORDER_STATUSES, type OrderStatus, type PaymentStatus } from '@moodly/shared';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  EN_ATTENTE: 'En attente',
  TISSU_RECU: 'Tissu reçu',
  COUPE: 'Coupe',
  COUTURE: 'Couture',
  FINITIONS: 'Finitions',
  PRET: 'Prêt',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  EN_ATTENTE: 'Paiement en attente',
  ACOMPTE: 'Acompte versé',
  PAYE: 'Payé',
};

// Chaîne de production (hors ANNULEE, statut terminal transverse).
export const CHAIN = ORDER_STATUSES.filter((s) => s !== 'ANNULEE');

/** Le prochain statut de production, ou null si terminal. */
export function nextStatus(current: OrderStatus): OrderStatus | null {
  if (current === 'LIVREE' || current === 'ANNULEE') return null;
  const i = CHAIN.indexOf(current);
  return i >= 0 && i < CHAIN.length - 1 ? CHAIN[i + 1] : null;
}

/** Progression 0..1 dans la chaîne (1 si livrée, 0 si annulée). */
export function progress(status: OrderStatus): number {
  if (status === 'ANNULEE') return 0;
  const i = CHAIN.indexOf(status);
  return i < 0 ? 0 : i / (CHAIN.length - 1);
}

/** Prix FCFA formaté (ex. 25000 → « 25 000 FCFA »). */
export function formatPrice(amount: number | null): string {
  if (amount == null) return 'Prix à définir';
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}
