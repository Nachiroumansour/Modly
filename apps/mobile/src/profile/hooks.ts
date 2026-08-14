import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, apiUpload } from '../lib/api';
import { buildPhotosForm } from './buildPhotosForm';

export type ProfileInput = {
  bio?: string;
  location?: string;
  specialties?: string[];
  yearsExperience?: number;
  priceMin?: number;
  priceMax?: number;
};

function useInvalidateProfile() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['tailor'] });
    qc.invalidateQueries({ queryKey: ['me'] });
  };
}

export function useUpdateProfile() {
  const { token } = useAuth();
  const invalidate = useInvalidateProfile();
  const m = useMutation({
    mutationFn: (input: ProfileInput) =>
      apiFetch('/me/profile', { method: 'PATCH', token, body: input }),
    onSuccess: invalidate,
  });
  return { save: (input: ProfileInput) => m.mutateAsync(input), saving: m.isPending };
}

export function useUploadProfilePhotos() {
  const { token } = useAuth();
  const invalidate = useInvalidateProfile();
  const m = useMutation({
    mutationFn: (input: { avatarUri?: string; coverUri?: string }) =>
      apiUpload<{ avatarUrl: string | null; coverUrl: string | null }>(
        '/me/photos',
        buildPhotosForm(input),
        token,
      ),
    onSuccess: invalidate,
  });
  return {
    upload: (input: { avatarUri?: string; coverUri?: string }) => m.mutateAsync(input),
    uploading: m.isPending,
  };
}
