import type { MeasurementKey, MeasurementSource } from '@moodly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ApiUser, ClientRecord, Measurement } from '../types';

export type LinkedMeasurement = {
  id: string;
  tailor: ApiUser;
  latestMeasurement: Measurement | null;
};

/** Les mesures des fiches liées au compte du client connecté. */
export function useMyMeasurements() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['myMeasurements'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ records: LinkedMeasurement[] }>('/me/measurements', { token }),
  });
  return {
    records: q.data?.records ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

export function useClientRecords() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['clientRecords'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ records: ClientRecord[] }>('/client-records', { token }),
  });
  return {
    records: q.data?.records ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

export function useClientRecord(id: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['clientRecord', id],
    enabled: Boolean(token),
    queryFn: () =>
      apiFetch<{ record: ClientRecord; latestMeasurement: Measurement | null }>(
        `/client-records/${id}`,
        { token },
      ),
  });
  return {
    record: q.data?.record ?? null,
    latestMeasurement: q.data?.latestMeasurement ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

export function useClientMeasurements(id: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['clientMeasurements', id],
    enabled: Boolean(token),
    queryFn: () =>
      apiFetch<{ measurements: Measurement[] }>(`/client-records/${id}/measurements`, { token }),
  });
  return {
    measurements: q.data?.measurements ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

type CreateRecordInput = {
  name: string;
  phone?: string;
  stylePref?: string;
  tissuPref?: string;
  coupePref?: string;
  notes?: string;
};

export function useCreateClientRecord() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: CreateRecordInput) =>
      apiFetch<{ record: ClientRecord }>('/client-records', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientRecords'] }),
  });
  return { createRecord: (input: CreateRecordInput) => m.mutateAsync(input), creating: m.isPending };
}

type MeasureValues = Partial<Record<MeasurementKey, number>> & { source?: MeasurementSource };

export function useAddMeasurement(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (values: MeasureValues) =>
      apiFetch<{ measurement: Measurement }>(`/client-records/${id}/measurements`, {
        method: 'POST',
        body: values,
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientRecord', id] });
      qc.invalidateQueries({ queryKey: ['clientMeasurements', id] });
      qc.invalidateQueries({ queryKey: ['clientRecords'] });
    },
  });
  return { addMeasurement: (values: MeasureValues) => m.mutateAsync(values), saving: m.isPending };
}
