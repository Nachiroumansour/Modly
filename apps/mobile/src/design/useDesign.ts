import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Comment, Design, DesignDetail } from '../types';

/** Détail public d'un modèle + ses commentaires. */
export function useDesign(id: string) {
  const query = useQuery({
    queryKey: ['design', id],
    queryFn: () => apiFetch<DesignDetail>(`/designs/${id}`),
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
