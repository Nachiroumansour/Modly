import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, apiUpload } from '../lib/api';
import type { ApiUser, Design } from '../types';
import { buildDesignForm, type PublishInput } from './buildDesignForm';

type TailorProfilePayload = {
  tailor: ApiUser & { designsCount: number; followersCount: number };
  designs: Design[];
};

/** Le portfolio d'un tailleur (ses modèles publiés). */
export function usePortfolio(tailorId?: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['portfolio', tailorId],
    enabled: Boolean(tailorId),
    queryFn: () => apiFetch<TailorProfilePayload>(`/tailors/${tailorId}`, { token }),
  });
  return {
    designs: q.data?.designs ?? [],
    tailor: q.data?.tailor ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

export function usePublishDesign() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: PublishInput) => apiUpload<{ design: Design }>('/designs', buildDesignForm(input), token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
  return {
    publish: (input: PublishInput) => m.mutateAsync(input),
    publishing: m.isPending,
  };
}
