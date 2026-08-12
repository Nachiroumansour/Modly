import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { Design, FeedPage } from '../types';

const LIMIT = 20;
export type FeedScope = 'foryou' | 'following';

/** Feed paginé par curseur. scope 'following' = modèles des tailleurs suivis (auth). */
export function useFeed(scope: FeedScope = 'foryou') {
  const { token } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ['feed', scope],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const parts = [`limit=${LIMIT}`];
      if (pageParam) parts.push(`cursor=${pageParam}`);
      if (scope === 'following') parts.push('following=1');
      return apiFetch<FeedPage>(`/designs?${parts.join('&')}`, scope === 'following' ? { token } : {});
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const designs: Design[] = query.data?.pages.flatMap((p) => p.designs) ?? [];

  return {
    designs,
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: Boolean(query.hasNextPage),
    refetch: () => query.refetch(),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
  };
}
