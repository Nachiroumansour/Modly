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
import { colors, fonts, spacing } from '../theme';
import { ErrorRetry } from '../ui/ErrorRetry';
import { MasonryColumns } from './masonry';
import { useFeed } from './useFeed';

type FeedProps = {
  onOpenDesign?: (id: string) => void;
};

export function Feed({ onOpenDesign }: FeedProps = {}) {
  const insets = useSafeAreaInsets();
  const { designs, isLoading, isError, hasMore, refetch, loadMore } = useFeed();

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
        <MasonryColumns designs={designs} onOpen={(id) => onOpenDesign?.(id)} />
      )}
      {hasMore ? <ActivityIndicator style={styles.more} color={colors.accent} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.md, paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 32,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
  more: { marginVertical: spacing.lg },
});
