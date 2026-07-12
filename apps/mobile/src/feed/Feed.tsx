import { useMemo } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DesignCard } from '../components/DesignCard';
import { colors, fonts, spacing } from '../theme';
import type { Design } from '../types';
import { ErrorRetry } from '../ui/ErrorRetry';
import { useFeed } from './useFeed';

/** Répartit les modèles en 2 colonnes en équilibrant la hauteur (masonry Pinterest). */
function splitColumns(designs: Design[]): [Design[], Design[]] {
  const cols: [Design[], Design[]] = [[], []];
  const heights = [0, 0];
  for (const d of designs) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    cols[target].push(d);
    heights[target] += d.imageHeight / d.imageWidth;
  }
  return cols;
}

type FeedProps = {
  onOpenDesign?: (id: string) => void;
};

export function Feed({ onOpenDesign }: FeedProps = {}) {
  const insets = useSafeAreaInsets();
  const { designs, isLoading, isError, hasMore, refetch, loadMore } = useFeed();
  const [left, right] = useMemo(() => splitColumns(designs), [designs]);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 600) {
      loadMore();
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.center, styles.screen]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.center, styles.screen]}>
        <ErrorRetry message="Impossible de charger le feed." onRetry={refetch} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      onScroll={onScroll}
      scrollEventThrottle={200}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.brand}>Moodly</Text>
      {designs.length === 0 ? (
        <Text style={styles.empty}>Aucun modèle pour l'instant.</Text>
      ) : (
        <View style={styles.columns}>
          <View style={styles.column}>
            {left.map((d) => (
              <DesignCard key={d.id} design={d} onPress={() => onOpenDesign?.(d.id)} />
            ))}
          </View>
          <View style={styles.column}>
            {right.map((d) => (
              <DesignCard key={d.id} design={d} onPress={() => onOpenDesign?.(d.id)} />
            ))}
          </View>
        </View>
      )}
      {hasMore && <ActivityIndicator style={styles.more} color={colors.accent} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 32,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  columns: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1 },
  empty: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 16, marginTop: spacing.xxl, textAlign: 'center' },
  more: { marginVertical: spacing.lg },
});
