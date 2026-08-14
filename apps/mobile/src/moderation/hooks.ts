import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ReportReason, ReportTargetType } from './reasons';

type ReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
};

export function useReport() {
  const { token } = useAuth();
  const m = useMutation({
    mutationFn: (input: ReportInput) => apiFetch('/reports', { method: 'POST', token, body: input }),
  });
  return { report: (input: ReportInput) => m.mutateAsync(input), sending: m.isPending };
}

function useBlockMutation(method: 'POST' | 'DELETE') {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFetch(`/users/${userId}/block`, { method, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocks'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['tailor'] });
    },
  });
}

export function useBlock() {
  const m = useBlockMutation('POST');
  return { block: (userId: string) => m.mutateAsync(userId), blocking: m.isPending };
}

export function useUnblock() {
  const m = useBlockMutation('DELETE');
  return { unblock: (userId: string) => m.mutateAsync(userId), unblocking: m.isPending };
}

export function useBlockedIds() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['blocks'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ blockedIds: string[] }>('/me/blocks', { token }),
  });
  const blockedIds = q.data?.blockedIds ?? [];
  return { blockedIds, isBlocked: (id: string) => blockedIds.includes(id) };
}
