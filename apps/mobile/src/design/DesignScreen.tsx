import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { MasonryColumns } from '../feed/masonry';
import { colors, fonts, radius, spacing } from '../theme';
import { Button } from '../ui/Button';
import { ErrorRetry } from '../ui/ErrorRetry';
import { MediaCarousel } from './MediaCarousel';
import { SocialActionBar } from './SocialActionBar';
import { useDesign } from './useDesign';
import { useDesignActions } from './useDesignActions';
import { useSimilar } from './useSimilar';

type Props = {
  id: string;
  onRequireAuth?: () => void;
  onBack?: () => void;
  onOrder?: () => void;
  onTailor?: (tailorId: string) => void;
  onOpenDesign?: (id: string) => void;
};

export function DesignScreen({ id, onRequireAuth, onBack, onOrder, onTailor, onOpenDesign }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { design, comments, isLoading, isError, refetch } = useDesign(id);
  const { designs: similar } = useSimilar(id);
  const actions = useDesignActions(id);
  const authed = Boolean(user);
  const gate = onRequireAuth ?? (() => {});

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
        <ErrorRetry message="Impossible de charger ce modele." onRetry={refetch} dark />
      </View>
    );
  }

  const like = () => (authed ? actions.toggleLike(design.likedByMe) : gate());
  const save = () => (authed ? actions.toggleBookmark(design.bookmarkedByMe) : gate());
  const share = () =>
    Share.share({ message: `${design.title} par ${design.tailor.name} sur Modly` });
  const initial = design.tailor.name.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View>
          <MediaCarousel
            media={design.media}
            cover={{
              url: design.imageUrl,
              width: design.imageWidth,
              height: design.imageHeight,
              blurhash: design.coverBlurhash,
            }}
            onDoubleTapLike={like}
          />
          {onBack ? (
            <Pressable onPress={onBack} style={[styles.back, { top: insets.top + spacing.sm }]} hitSlop={10}>
              <Feather name="chevron-left" size={26} color={colors.textOnDark} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{design.title}</Text>

          <Pressable style={styles.author} onPress={() => onTailor?.(design.tailor.id)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.authorName}>{design.tailor.name}</Text>
            <Feather name="chevron-right" size={18} color={colors.textOnDarkMuted} />
          </Pressable>

          {design.description ? <Text style={styles.description}>{design.description}</Text> : null}

          <SocialActionBar
            liked={design.likedByMe}
            saved={design.bookmarkedByMe}
            likesCount={design.likesCount}
            commentsCount={design.commentsCount}
            bookmarksCount={design.bookmarksCount}
            onLike={like}
            onSave={save}
            onShare={share}
            onComment={() => (authed ? undefined : gate())}
          />

          {similar.length > 0 ? (
            <View style={styles.similar}>
              <Text style={styles.sectionTitle}>Explorer davantage</Text>
              <MasonryColumns designs={similar} onOpen={(sid) => onOpenDesign?.(sid)} />
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Commentaires</Text>
          {authed ? (
            <View style={styles.commentBox}>
              <TextInput
                value={actions.commentText}
                onChangeText={actions.setCommentText}
                placeholder="Ecris un commentaire..."
                placeholderTextColor={colors.textOnDarkMuted}
                style={styles.commentInput}
                multiline
              />
              <Pressable onPress={actions.submitComment} disabled={actions.commenting} style={styles.send}>
                <Feather name="send" size={18} color={colors.textOnDark} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={gate} style={styles.commentGate}>
              <Text style={styles.commentGateText}>Connecte-toi pour commenter</Text>
            </Pressable>
          )}
          {comments.length === 0 ? (
            <Text style={styles.noComments}>Sois le premier a commenter.</Text>
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
        <Button label="Commander ce modele" onPress={() => (authed ? onOrder?.() : gate())} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 15 },
  authorName: { flex: 1, color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
  description: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  similar: { marginTop: spacing.xxl },
  sectionTitle: {
    color: colors.textOnDark,
    fontFamily: fonts.bodyHeavy,
    fontSize: 16,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  commentBox: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.lg },
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
