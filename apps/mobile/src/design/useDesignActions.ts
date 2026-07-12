import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

/**
 * Actions authentifiées sur un modèle : like, sauvegarde, commentaire.
 * Idempotent côté API ; on rafraîchit le détail et le feed après coup.
 */
export function useDesignActions(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState('');

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['design', id] });
    qc.invalidateQueries({ queryKey: ['feed'] });
    qc.invalidateQueries({ queryKey: ['bookmarks'] });
  }

  const toggleLike = useMutation({
    mutationFn: (liked: boolean) =>
      apiFetch(`/designs/${id}/like`, { method: liked ? 'DELETE' : 'POST', token }),
    onSuccess: invalidate,
  });

  const toggleBookmark = useMutation({
    mutationFn: (saved: boolean) =>
      apiFetch(`/designs/${id}/bookmark`, { method: saved ? 'DELETE' : 'POST', token }),
    onSuccess: invalidate,
  });

  const comment = useMutation({
    mutationFn: (text: string) =>
      apiFetch(`/designs/${id}/comments`, { method: 'POST', body: { text }, token }),
    onSuccess: () => {
      setCommentText('');
      invalidate();
    },
  });

  return {
    toggleLike: (liked: boolean) => toggleLike.mutate(liked),
    toggleBookmark: (saved: boolean) => toggleBookmark.mutate(saved),
    commentText,
    setCommentText,
    submitComment: () => {
      const t = commentText.trim();
      if (t.length > 0) comment.mutate(t);
    },
    commenting: comment.isPending,
  };
}
