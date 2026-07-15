import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { Design } from '../types';

/** Modeles similaires (Explorer davantage) : meme tailleur puis meme categorie. */
export function useSimilar(id: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['similar', id],
    queryFn: () => apiFetch<{ designs: Design[] }>(`/designs/${id}/similar`, { token }),
  });
  return { designs: q.data?.designs ?? [], isLoading: q.isLoading, isError: q.isError };
}
