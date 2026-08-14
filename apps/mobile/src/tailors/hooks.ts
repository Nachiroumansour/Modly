import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { Design } from '../types';

export type TailorProfile = {
  bio: string | null;
  coverUrl: string | null;
  location: string | null;
  specialties: string[];
  yearsExperience: number | null;
  priceMin: number | null;
  priceMax: number | null;
  verified: boolean;
} | null;

export type TailorPayload = {
  tailor: {
    id: string;
    name: string;
    avatarUrl: string | null;
    createdAt: string;
    profile: TailorProfile;
    followersCount: number;
    designsCount: number;
    likesTotal: number;
  };
  designs: Design[];
  followedByMe: boolean;
};

export function useTailorProfile(id: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['tailor', id],
    enabled: Boolean(id),
    queryFn: () => apiFetch<TailorPayload>(`/tailors/${id}`, { token }),
  });
  return {
    tailor: q.data?.tailor ?? null,
    designs: q.data?.designs ?? [],
    followedByMe: q.data?.followedByMe ?? false,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

export function useFollow(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (following: boolean) =>
      apiFetch(`/tailors/${id}/follow`, { method: following ? 'DELETE' : 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tailor', id] }),
  });
  return { toggleFollow: (following: boolean) => m.mutate(following), following: m.isPending };
}
