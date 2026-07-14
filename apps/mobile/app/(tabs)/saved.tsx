import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MasonryColumns } from '../../src/feed/masonry';
import { useBookmarks } from '../../src/feed/useBookmarks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { AppHeader } from '../../src/ui/AppHeader';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

export default function SavedTab() {
  const router = useRouter();
  const { designs, isLoading, isError, refetch } = useBookmarks();

  if (isLoading) {
    return (
      <View style={styles.outer}>
        <AppHeader />
        <View style={[styles.root, styles.center]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.outer}>
        <AppHeader />
        <View style={[styles.root, styles.center]}>
          <ErrorRetry message="Impossible de charger tes sauvegardes." onRetry={refetch} dark />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <AppHeader />
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingTop: spacing.lg, paddingHorizontal: spacing.md, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Sauvegardés</Text>
        {designs.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.badge}>
              <Feather name="bookmark" size={26} color={colors.accent} />
            </View>
            <Text style={styles.emptyText}>Touche l'icône marque-page sur un modèle pour le retrouver ici.</Text>
          </View>
        ) : (
          <MasonryColumns designs={designs} onOpen={(id) => router.push(`/design/${id}`)} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.ink },
  root: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: {
    color: colors.textOnDark,
    fontFamily: fonts.displayBold,
    fontSize: 30,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
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
});
