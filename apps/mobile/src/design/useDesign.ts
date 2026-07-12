import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { Comment, Design, DesignDetail } from '../types';

/** Détail public d'un modèle + ses commentaires (l'état liké/sauvegardé dépend de la session). */
export function useDesign(id: string) {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ['design', id, token ? 'me' : 'anon'],
    queryFn: () => apiFetch<DesignDetail>(`/designs/${id}`, { token }),
  });

  const design: Design | null = query.data?.design ?? null;
  const comments: Comment[] = query.data?.comments ?? [];

  return {
    design,
    comments,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => query.refetch(),
  };
}
