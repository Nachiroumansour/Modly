import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { MasonryColumns } from '../feed/masonry';
import { useBlock } from '../moderation/hooks';
import { ReportSheet } from '../moderation/ReportSheet';
import type { ReportTargetType } from '../moderation/reasons';
import { colors, fonts, radius, spacing } from '../theme';
import { Button } from '../ui/Button';
import { ErrorRetry } from '../ui/ErrorRetry';
import { CommentsSheet } from './CommentsSheet';
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
  const { design, isLoading, isError, refetch } = useDesign(id);
  const { designs: similar } = useSimilar(id);
  const actions = useDesignActions(id);
  const authed = Boolean(user);
  const gate = onRequireAuth ?? (() => {});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(null);
  const { block } = useBlock();

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
          <Pressable
            onPress={() => (authed ? setMenuOpen(true) : gate())}
            style={[styles.more, { top: insets.top + spacing.sm }]}
            hitSlop={10}
          >
            <Feather name="more-horizontal" size={24} color={colors.textOnDark} />
          </Pressable>
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

          {design.postType === 'ORIGINAL' ? (
            <Pressable style={styles.originalBadge} onPress={() => onTailor?.(design.tailor.id)}>
              <Text style={styles.originalMark}>✦</Text>
              <Text style={styles.originalText}>
                Création originale · {new Date(design.createdAt).toLocaleDateString('fr-FR')}
              </Text>
            </Pressable>
          ) : design.sourceCredit ? (
            <Text style={styles.sourceLine}>Source : {design.sourceCredit}</Text>
          ) : null}

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
            onComment={() => setCommentsOpen(true)}
          />

          {similar.length > 0 ? (
            <View style={styles.similar}>
              <Text style={styles.sectionTitle}>Explorer davantage</Text>
              <MasonryColumns designs={similar} onOpen={(sid) => onOpenDesign?.(sid)} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Commander ce modele" onPress={() => (authed ? onOrder?.() : gate())} />
      </View>

      <CommentsSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        designId={id}
        viewerId={user?.id ?? ''}
        designTailorId={design.tailor.id}
        authed={authed}
        onRequireAuth={gate}
      />

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                setReportTarget({ type: 'DESIGN', id: design.id });
              }}
            >
              <Feather name="flag" size={16} color={colors.textOnDark} />
              <Text style={styles.menuText}>Signaler le modèle</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                setReportTarget({ type: 'USER', id: design.tailor.id });
              }}
            >
              <Feather name="flag" size={16} color={colors.textOnDark} />
              <Text style={styles.menuText}>Signaler le tailleur</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                block(design.tailor.id);
              }}
            >
              <Feather name="slash" size={16} color={colors.danger} />
              <Text style={[styles.menuText, { color: colors.danger }]}>Bloquer le tailleur</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {reportTarget ? (
        <ReportSheet
          visible
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      ) : null}
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
  more: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: colors.inkElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  menuText: { color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
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
  originalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  originalMark: { color: colors.accent, fontFamily: fonts.bodyHeavy, fontSize: 13 },
  originalText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 },
  sourceLine: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13, marginTop: spacing.md },
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
