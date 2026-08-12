import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ApiNotification } from '../types';

type Page = { notifications: ApiNotification[]; nextCursor: string | null };

export function useNotifications() {
  const { token } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ['notifications'],
    enabled: Boolean(token),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch<Page>(`/me/notifications${pageParam ? `?cursor=${pageParam}` : ''}`, { token }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  return {
    notifications: q.data?.pages.flatMap((p) => p.notifications) ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    hasMore: Boolean(q.hasNextPage),
    loadMore: () => q.fetchNextPage(),
    refetch: () => q.refetch(),
  };
}

export function useUnreadCount() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['notifications', 'unread'],
    enabled: Boolean(token),
    refetchOnWindowFocus: true,
    queryFn: () => apiFetch<{ count: number }>('/me/notifications/unread-count', { token }),
  });
  return { count: q.data?.count ?? 0, refetch: () => q.refetch() };
}

export function useMarkAllRead() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/me/notifications/read-all', { method: 'POST', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  return { markAllRead: () => m.mutateAsync() };
}
