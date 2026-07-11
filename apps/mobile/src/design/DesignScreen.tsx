import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';
import { Button } from '../ui/Button';
import { ErrorRetry } from '../ui/ErrorRetry';
import { useDesign } from './useDesign';

type Props = {
  id: string;
  onRequireAuth?: () => void;
  onBack?: () => void;
};

export function DesignScreen({ id, onRequireAuth, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { design, comments, isLoading, isError, refetch } = useDesign(id);

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        <Image
          source={{ uri: design.imageUrl }}
          style={[styles.image, { aspectRatio: design.imageWidth / design.imageHeight }]}
          contentFit="cover"
          transition={200}
        />
        {onBack && (
          <Pressable onPress={onBack} style={[styles.back, { top: insets.top + spacing.md }]}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{design.title}</Text>
          <Text style={styles.tailor}>{design.tailor.name}</Text>
          {design.description && <Text style={styles.description}>{design.description}</Text>}

          <View style={styles.stats}>
            <Stat value={design.likesCount} label="J'aime" />
            <Stat value={design.commentsCount} label="Commentaires" />
            <Stat value={design.bookmarksCount} label="Sauvegardes" />
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.actionGhost} onPress={onRequireAuth}>
              <Text style={styles.actionGhostText}>♥  J'aime</Text>
            </Pressable>
            <Pressable style={styles.actionGhost} onPress={onRequireAuth}>
              <Text style={styles.actionGhostText}>◎  Sauvegarder</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Commentaires</Text>
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
        <Button label="Commander ce modèle" onPress={() => onRequireAuth?.()} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: colors.textOnDark, fontSize: 28, lineHeight: 30, fontWeight: '700' },
  body: { padding: spacing.xl },
  title: { color: colors.textOnDark, fontSize: typography.title.fontSize, fontWeight: '800' },
  tailor: { color: colors.accent, fontSize: typography.label.fontSize, fontWeight: '600', marginTop: spacing.xs },
  description: { color: colors.textOnDarkMuted, fontSize: typography.body.fontSize, marginTop: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl },
  stat: {},
  statValue: { color: colors.textOnDark, fontSize: typography.title.fontSize, fontWeight: '800' },
  statLabel: { color: colors.textOnDarkMuted, fontSize: typography.caption.fontSize, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  actionGhost: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGhostText: { color: colors.textOnDark, fontWeight: '600' },
  sectionTitle: { color: colors.textOnDark, fontSize: typography.label.fontSize, fontWeight: '700', marginTop: spacing.xxl, marginBottom: spacing.md },
  noComments: { color: colors.textOnDarkMuted },
  comment: { marginBottom: spacing.lg },
  commentAuthor: { color: colors.textOnDark, fontWeight: '700', fontSize: typography.caption.fontSize },
  commentText: { color: colors.textOnDarkMuted, marginTop: 2 },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.inkElevated,
  },
});
