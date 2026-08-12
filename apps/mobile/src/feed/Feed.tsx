import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { ErrorRetry } from '../ui/ErrorRetry';
import { MasonryColumns } from './masonry';
import { useFeed, type FeedScope } from './useFeed';

type FeedProps = {
  onOpenDesign?: (id: string) => void;
  scope?: FeedScope;
};

export function Feed({ onOpenDesign, scope = 'foryou' }: FeedProps = {}) {
  const { designs, isLoading, isError, hasMore, refetch, loadMore } = useFeed(scope);

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
      contentContainerStyle={[styles.content, { paddingTop: spacing.md }]}
      onScroll={onScroll}
      scrollEventThrottle={200}
      showsVerticalScrollIndicator={false}
    >
      {designs.length === 0 ? (
        <Text style={styles.empty}>
          {scope === 'following'
            ? 'Suis des tailleurs pour voir leurs nouveautés ici.'
            : "Aucun modèle pour l'instant."}
        </Text>
      ) : (
        <MasonryColumns designs={designs} onOpen={(id) => onOpenDesign?.(id)} />
      )}
      {hasMore ? <ActivityIndicator style={styles.more} color={colors.accent} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { paddingHorizontal: spacing.md, paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
  more: { marginVertical: spacing.lg },
});
