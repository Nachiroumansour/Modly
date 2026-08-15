import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReportSheet } from '../moderation/ReportSheet';
import { colors, fonts, radius, spacing } from '../theme';
import type { ApiComment } from '../types';

type Props = {
  comment: ApiComment;
  viewerId: string;
  designTailorId: string;
  onLike: (id: string, liked: boolean) => void;
  onReply: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
};

export function CommentItem({ comment, viewerId, designTailorId, onLike, onReply, onDelete, onPin }: Props) {
  const isRoot = comment.parentId === null;
  const isMine = comment.user.id === viewerId;
  const canPin = isRoot && viewerId === designTailorId;
  const initial = comment.user.name.trim().charAt(0).toUpperCase();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <View style={[styles.item, !isRoot && styles.reply]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.body}>
        {comment.pinned ? (
          <View style={styles.pinBadge}>
            <Feather name="bookmark" size={11} color={colors.accent} />
            <Text style={styles.pinText}>Épinglé</Text>
          </View>
        ) : null}
        <Text style={styles.author}>{comment.user.name}</Text>
        <Text style={styles.text}>{comment.text}</Text>

        <View style={styles.actions}>
          <Pressable testID={`comment-like-${comment.id}`} style={styles.action} onPress={() => onLike(comment.id, comment.likedByMe)}>
            <Feather name="heart" size={14} color={comment.likedByMe ? colors.accent : colors.textOnDarkMuted} />
            {comment.likesCount > 0 ? <Text style={styles.actionText}>{comment.likesCount}</Text> : null}
          </Pressable>
          {isRoot ? (
            <Pressable testID={`comment-reply-${comment.id}`} onPress={() => onReply(comment.id, comment.user.name)}>
              <Text style={styles.actionText}>Répondre</Text>
            </Pressable>
          ) : null}
          {isMine ? (
            <Pressable testID={`comment-delete-${comment.id}`} onPress={() => onDelete(comment.id)}>
              <Text style={styles.actionText}>Supprimer</Text>
            </Pressable>
          ) : null}
          {canPin ? (
            <Pressable testID={`comment-pin-${comment.id}`} onPress={() => onPin(comment.id, !comment.pinned)}>
              <Text style={[styles.actionText, comment.pinned && styles.actionActive]}>
                {comment.pinned ? 'Désépingler' : 'Épingler'}
              </Text>
            </Pressable>
          ) : null}
          {!isMine ? (
            <Pressable testID={`comment-report-${comment.id}`} onPress={() => setReportOpen(true)}>
              <Text style={styles.actionText}>Signaler</Text>
            </Pressable>
          ) : null}
        </View>

        {reportOpen ? (
          <ReportSheet
            visible
            targetType="COMMENT"
            targetId={comment.id}
            onClose={() => setReportOpen(false)}
          />
        ) : null}

        {comment.replies.map((r) => (
          <CommentItem
            key={r.id}
            comment={r}
            viewerId={viewerId}
            designTailorId={designTailorId}
            onLike={onLike}
            onReply={onReply}
            onDelete={onDelete}
            onPin={onPin}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  reply: { marginTop: spacing.md, marginBottom: 0 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 13 },
  body: { flex: 1 },
  pinBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  pinText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 11 },
  author: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 13 },
  text: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 14, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 12 },
  actionActive: { color: colors.accent },
});
