import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { imageUri } from '../lib/config';
import type { FeedPage } from '../types';

/**
 * Couvertures publiques pour le collage des écrans d'auth.
 * Le feed est public (aucun compte requis) ; en cas d'erreur/chargement,
 * renvoie une liste vide → le collage bascule sur son visuel de repli.
 */
export function useAuthCovers(count = 12): string[] {
  const query = useQuery({
    queryKey: ['auth-covers', count],
    queryFn: () => apiFetch<FeedPage>(`/designs?limit=${count}`),
    staleTime: 1000 * 60 * 5,
  });
  return (query.data?.designs ?? []).map((d) => imageUri(d.imageUrl));
}
