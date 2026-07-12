import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { usePortfolio } from '../../src/designs/hooks';
import { MasonryColumns } from '../../src/feed/masonry';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

export default function PortfolioTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { designs, isLoading, isError, refetch } = usePortfolio(user?.id);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={[styles.root, styles.center]}>
        <ErrorRetry message="Impossible de charger tes modèles." onRetry={refetch} dark />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.md, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={styles.title}>Mes modèles</Text>
        <Pressable style={styles.publish} onPress={() => router.push('/publish')}>
          <Feather name="plus" size={18} color={colors.textOnDark} />
          <Text style={styles.publishText}>Publier</Text>
        </Pressable>
      </View>

      {designs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.badge}>
            <Feather name="image" size={26} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>Publie ton premier modèle pour le montrer à toute la communauté.</Text>
          <Pressable style={styles.cta} onPress={() => router.push('/publish')}>
            <Text style={styles.ctaText}>Publier un modèle</Text>
          </Pressable>
        </View>
      ) : (
        <MasonryColumns designs={designs} onOpen={(id) => router.push(`/design/${id}`)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 30 },
  publish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  publishText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  empty: { alignItems: 'center', marginTop: spacing.xxl * 2, gap: spacing.md, paddingHorizontal: spacing.xl },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.inkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  cta: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  ctaText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
});
