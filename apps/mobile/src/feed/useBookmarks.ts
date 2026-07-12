import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { Design } from '../types';

/** Les modèles sauvegardés par l'utilisateur connecté. */
export function useBookmarks() {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ['bookmarks'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ designs: Design[] }>('/me/bookmarks', { token }),
  });

  return {
    designs: query.data?.designs ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => query.refetch(),
  };
}
