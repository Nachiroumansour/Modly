import type { OrderStatus, PaymentStatus } from '@moodly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { Order, OrderDetail } from '../types';

export function useOrders() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['orders'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ orders: Order[] }>('/orders', { token }),
  });
  return {
    orders: q.data?.orders ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

export function useOrder(id: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['order', id],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ order: OrderDetail }>(`/orders/${id}`, { token }),
  });
  return {
    order: q.data?.order ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => q.refetch(),
  };
}

type CreateInput = { tailorId: string; designId?: string; note?: string };

export function useCreateOrder() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: CreateInput) =>
      apiFetch<{ order: Order }>('/orders', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
  return {
    createOrder: (input: CreateInput) => m.mutateAsync(input),
    creating: m.isPending,
  };
}

/** Actions tailleur sur une commande : avancer le statut, fixer prix/paiement. */
export function useOrderManage(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['order', id] });
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const status = useMutation({
    mutationFn: (next: OrderStatus) =>
      apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: { status: next }, token }),
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: (data: { agreedPrice?: number; paymentStatus?: PaymentStatus }) =>
      apiFetch(`/orders/${id}`, { method: 'PATCH', body: data, token }),
    onSuccess: invalidate,
  });

  return {
    setStatus: (next: OrderStatus) => status.mutate(next),
    statusPending: status.isPending,
    updateOrder: (data: { agreedPrice?: number; paymentStatus?: PaymentStatus }) => patch.mutate(data),
    updatePending: patch.isPending,
  };
}
