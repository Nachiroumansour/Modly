import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { CollectionSummary, Design } from '../types';

export function useCollections() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['collections'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ collections: CollectionSummary[] }>('/me/collections', { token }),
  });
  return {
    collections: q.data?.collections ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

export function useCollection(id: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['collection', id],
    enabled: Boolean(token && id),
    queryFn: () =>
      apiFetch<{ collection: { id: string; name: string }; designs: Design[] }>(
        `/me/collections/${id}`,
        { token },
      ),
  });
  return {
    collection: q.data?.collection ?? null,
    designs: q.data?.designs ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['collections'] });
    qc.invalidateQueries({ queryKey: ['bookmarks'] });
  };
}

export function useCreateCollection() {
  const { token } = useAuth();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ collection: CollectionSummary }>('/me/collections', { method: 'POST', body: { name }, token }),
    onSuccess: invalidate,
  });
  return { create: (name: string) => m.mutateAsync(name), creating: m.isPending };
}

export function useRenameCollection() {
  const { token } = useAuth();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/me/collections/${id}`, { method: 'PATCH', body: { name }, token }),
    onSuccess: invalidate,
  });
  return { rename: (id: string, name: string) => m.mutateAsync({ id, name }), renaming: m.isPending };
}

export function useDeleteCollection() {
  const { token } = useAuth();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: (id: string) => apiFetch(`/me/collections/${id}`, { method: 'DELETE', token }),
    onSuccess: invalidate,
  });
  return { remove: (id: string) => m.mutateAsync(id), removing: m.isPending };
}

export function useMoveBookmark() {
  const { token } = useAuth();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: ({ designId, collectionId }: { designId: string; collectionId: string | null }) =>
      apiFetch(`/me/bookmarks/${designId}`, { method: 'PATCH', body: { collectionId }, token }),
    onSuccess: invalidate,
  });
  return {
    move: (designId: string, collectionId: string | null) => m.mutateAsync({ designId, collectionId }),
    moving: m.isPending,
  };
}
