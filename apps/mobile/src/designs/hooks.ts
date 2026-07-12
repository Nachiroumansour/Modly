import type { DesignCategory } from '@moodly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, apiUpload } from '../lib/api';
import type { ApiUser, Design } from '../types';

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

type PublishInput = {
  uri: string;
  title: string;
  category: DesignCategory;
  description?: string;
};

export function usePublishDesign() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: PublishInput) => {
      const form = new FormData();
      form.append('title', input.title);
      form.append('category', input.category);
      if (input.description) form.append('description', input.description);

      const name = input.uri.split('/').pop() ?? 'model.jpg';
      const ext = (name.split('.').pop() ?? 'jpg').toLowerCase();
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      form.append('image', { uri: input.uri, name, type } as unknown as Blob);

      return apiUpload<{ design: Design }>('/designs', form, token);
    },
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
