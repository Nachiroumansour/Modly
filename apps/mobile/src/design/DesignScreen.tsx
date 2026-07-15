import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { imageUri } from '../lib/config';
import { colors, fonts, radius, spacing } from '../theme';
import { Button } from '../ui/Button';
import { ErrorRetry } from '../ui/ErrorRetry';
import { useDesign } from './useDesign';
import { useDesignActions } from './useDesignActions';

type FeatherName = keyof typeof Feather.glyphMap;

type Props = {
  id: string;
  onRequireAuth?: () => void;
  onBack?: () => void;
  onOrder?: () => void;
  onTailor?: (tailorId: string) => void;
};

export function DesignScreen({ id, onRequireAuth, onBack, onOrder, onTailor }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { design, comments, isLoading, isError, refetch } = useDesign(id);
  const actions = useDesignActions(id);
  const authed = Boolean(user);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (isError || !design) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ErrorRetry message="Impossible de charger ce modèle." onRetry={refetch} dark />
      </View>
    );
  }

  const gate = onRequireAuth ?? (() => {});

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <Image
          source={{ uri: imageUri(design.imageUrl) }}
          style={[styles.image, { aspectRatio: design.imageWidth / design.imageHeight }]}
          contentFit="cover"
          transition={200}
        />
        {onBack ? (
          <Pressable onPress={onBack} style={[styles.back, { top: insets.top + spacing.sm }]} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
        ) : null}

        <View style={styles.body}>
          <Text style={styles.title}>{design.title}</Text>
          <Pressable onPress={() => onTailor?.(design.tailor.id)}>
            <Text style={styles.tailor}>par {design.tailor.name} ›</Text>
          </Pressable>
          {design.description ? <Text style={styles.description}>{design.description}</Text> : null}

          <View style={styles.stats}>
            <Stat icon="heart" value={design.likesCount} />
            <Stat icon="message-circle" value={design.commentsCount} />
            <Stat icon="bookmark" value={design.bookmarksCount} />
          </View>

          <View style={styles.actions}>
            <ActionGhost
              icon="heart"
              label={design.likedByMe ? 'Aimé' : "J'aime"}
              active={design.likedByMe}
              onPress={() => (authed ? actions.toggleLike(design.likedByMe) : gate())}
            />
            <ActionGhost
              icon="bookmark"
              label={design.bookmarkedByMe ? 'Sauvegardé' : 'Sauvegarder'}
              active={design.bookmarkedByMe}
              onPress={() => (authed ? actions.toggleBookmark(design.bookmarkedByMe) : gate())}
            />
          </View>

          <Text style={styles.sectionTitle}>Commentaires</Text>

          {authed ? (
            <View style={styles.commentBox}>
              <TextInput
                value={actions.commentText}
                onChangeText={actions.setCommentText}
                placeholder="Écris un commentaire…"
                placeholderTextColor={colors.textOnDarkMuted}
                style={styles.commentInput}
                multiline
              />
              <Pressable
                onPress={actions.submitComment}
                disabled={actions.commenting}
                style={styles.send}
              >
                <Feather name="send" size={18} color={colors.textOnDark} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={gate} style={styles.commentGate}>
              <Text style={styles.commentGateText}>Connecte-toi pour commenter</Text>
            </Pressable>
          )}

          {comments.length === 0 ? (
            <Text style={styles.noComments}>Sois le premier à commenter.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <Text style={styles.commentAuthor}>{c.user.name}</Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label="Commander ce modèle"
          onPress={() => (authed ? onOrder?.() : gate())}
        />
      </View>
    </View>
  );
}

function Stat({ icon, value }: { icon: FeatherName; value: number }) {
  return (
    <View style={styles.stat}>
      <Feather name={icon} size={16} color={colors.textOnDarkMuted} />
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ActionGhost({
  icon,
  label,
  active,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.actionGhost, active && styles.actionActive]} onPress={onPress}>
      <Feather name={icon} size={18} color={active ? colors.accent : colors.textOnDark} />
      <Text style={[styles.actionGhostText, active && styles.actionActiveText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', backgroundColor: colors.inkElevated },
  back: {
    position: 'absolute',
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.xl },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32 },
  tailor: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 15, marginTop: spacing.xs },
  description: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  actionGhost: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkLine,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  actionGhostText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  actionActiveText: { color: colors.accent },
  sectionTitle: {
    color: colors.textOnDark,
    fontFamily: fonts.bodyHeavy,
    fontSize: 16,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  commentInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentGate: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkLine,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  commentGateText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  noComments: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular },
  comment: { marginBottom: spacing.lg },
  commentAuthor: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 13 },
  commentText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, marginTop: 2 },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.inkLine,
  },
});
