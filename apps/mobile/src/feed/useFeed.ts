import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Design, Feed } from '../types';

const LIMIT = 20;

/** Feed public paginé. Aplati les pages en une liste de modèles pour l'affichage. */
export function useFeed() {
  const query = useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiFetch<Feed>(`/designs?page=${pageParam}&limit=${LIMIT}`),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
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
