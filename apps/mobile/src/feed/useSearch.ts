import type { DesignCategory } from '@moodly/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Design, Feed } from '../types';

export type SearchParams = {
  search: string;
  category: DesignCategory | null;
  sort: 'recent' | 'tendance';
};

const LIMIT = 20;

export function useSearch({ search, category, sort }: SearchParams) {
  const trimmed = search.trim();
  const query = useInfiniteQuery({
    queryKey: ['search', trimmed, category ?? '', sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const parts = [`page=${pageParam}`, `limit=${LIMIT}`, `sort=${sort}`];
      if (trimmed.length > 0) parts.push(`search=${encodeURIComponent(trimmed)}`);
      if (category) parts.push(`category=${category}`);
      return apiFetch<Feed>(`/designs?${parts.join('&')}`);
    },
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
