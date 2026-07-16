import type { MeasurementKey } from '@moodly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { SelfMeasurement } from '../types';

/** Les mesures personnelles du client connecte (une par compte, editable). */
export function useSelfMeasurement() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['selfMeasurement'],
    enabled: Boolean(token),
    queryFn: () =>
      apiFetch<{ measurement: SelfMeasurement | null }>('/me/self-measurement', { token }),
  });
  return {
    measurement: q.data?.measurement ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

export function useSaveSelfMeasurement() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (values: Partial<Record<MeasurementKey, number>>) =>
      apiFetch<{ measurement: SelfMeasurement }>('/me/self-measurement', {
        method: 'PUT',
        body: values,
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['selfMeasurement'] }),
  });
  return {
    save: (v: Partial<Record<MeasurementKey, number>>) => m.mutateAsync(v),
    saving: m.isPending,
  };
}
