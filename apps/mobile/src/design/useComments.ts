import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ApiComment } from '../types';

/** Commentaires threadés d'un modèle + actions (post/reponse, like, suppression, épingle). */
export function useComments(designId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['comments', designId] });
    qc.invalidateQueries({ queryKey: ['design', designId] });
  };
  const q = useQuery({
    queryKey: ['comments', designId],
    queryFn: () => apiFetch<{ comments: ApiComment[] }>(`/designs/${designId}/comments`, { token }),
  });
  const post = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId?: string }) =>
      apiFetch(`/designs/${designId}/comments`, { method: 'POST', body: { text, parentId }, token }),
    onSuccess: invalidate,
  });
  const like = useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      apiFetch(`/comments/${commentId}/like`, { method: liked ? 'DELETE' : 'POST', token }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => apiFetch(`/comments/${commentId}`, { method: 'DELETE', token }),
    onSuccess: invalidate,
  });
  const pin = useMutation({
    mutationFn: ({ commentId, pinned }: { commentId: string; pinned: boolean }) =>
      apiFetch(`/comments/${commentId}/pin`, { method: 'PATCH', body: { pinned }, token }),
    onSuccess: invalidate,
  });
  return {
    comments: q.data?.comments ?? [],
    isLoading: q.isLoading,
    post: (text: string, parentId?: string) => post.mutateAsync({ text, parentId }),
    toggleLike: (commentId: string, liked: boolean) => like.mutate({ commentId, liked }),
    remove: (commentId: string) => remove.mutate(commentId),
    togglePin: (commentId: string, pinned: boolean) => pin.mutate({ commentId, pinned }),
  };
}
