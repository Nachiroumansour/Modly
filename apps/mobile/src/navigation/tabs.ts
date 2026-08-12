import type { Role } from '@moodly/shared';

export type TabName = 'feed' | 'search' | 'create' | 'saved' | 'orders' | 'profile';

/** Onglets visibles selon le rôle. Le 3e (index 2) est toujours l'onglet central. */
export function visibleTabs(role: Role | null): TabName[] {
  if (role === 'TAILLEUR') return ['feed', 'search', 'create', 'orders', 'profile'];
  if (role === 'CLIENT') return ['feed', 'search', 'saved', 'orders', 'profile'];
  return ['feed', 'search', 'profile'];
}

/** Onglet central mis en avant : Publier (tailleur) ou Sauvegardés (client). */
export function centerTab(role: Role | null): 'create' | 'saved' | null {
  if (role === 'TAILLEUR') return 'create';
  if (role === 'CLIENT') return 'saved';
  return null;
}
