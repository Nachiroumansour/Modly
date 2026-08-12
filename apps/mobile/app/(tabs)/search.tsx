import type { DesignCategory } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CATEGORY_LABELS, DESIGN_CATEGORIES } from '../../src/designs/categories';
import { MasonryColumns } from '../../src/feed/masonry';
import { useSearch } from '../../src/feed/useSearch';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { AppHeader } from '../../src/ui/AppHeader';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

export default function SearchTab() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState<DesignCategory | null>(null);
  const [sort, setSort] = useState<'recent' | 'tendance'>('recent');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  const { designs, isLoading, isError, hasMore, refetch, loadMore } = useSearch({
    search: debounced,
    category,
    sort,
  });

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 600) loadMore();
  }

  return (
    <View style={styles.outer}>
      <AppHeader />
      <View style={[styles.root, { paddingTop: spacing.sm }]}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.textOnDarkMuted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Rechercher un modèle…"
            placeholderTextColor={colors.textOnDarkMuted}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {text.length > 0 ? (
            <Pressable onPress={() => setText('')} hitSlop={8}>
              <Feather name="x" size={18} color={colors.textOnDarkMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsRow}
        >
          <Chip label="Tout" active={category === null} onPress={() => setCategory(null)} />
          {DESIGN_CATEGORIES.map((c) => (
            <Chip key={c} label={CATEGORY_LABELS[c]} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>

        <View style={styles.sortRow}>
          <SortItem label="Récent" active={sort === 'recent'} onPress={() => setSort('recent')} />
          <SortItem label="Tendance" active={sort === 'tendance'} onPress={() => setSort('tendance')} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <ErrorRetry message="Recherche indisponible." onRetry={refetch} dark />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.results}
            onScroll={onScroll}
            scrollEventThrottle={200}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {designs.length === 0 ? (
              <Text style={styles.empty}>Aucun modèle ne correspond.</Text>
            ) : (
              <MasonryColumns designs={designs} onOpen={(id) => router.push(`/design/${id}`)} />
            )}
            {hasMore ? <ActivityIndicator style={styles.more} color={colors.accent} /> : null}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SortItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.sortItem, active && styles.sortItemActive]} onPress={onPress}>
      <Text style={[styles.sortText, active && styles.sortTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.ink },
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.inkElevated,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
  chipsRow: { flexGrow: 0, marginTop: spacing.md },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.inkElevated },
  chipActive: { backgroundColor: colors.accentSoft },
  chipText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 13 },
  chipTextActive: { color: colors.accent },
  sortRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sortItem: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  sortItemActive: { backgroundColor: colors.inkElevated },
  sortText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 13 },
  sortTextActive: { color: colors.textOnDark },
  results: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: 110 },
  empty: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 15, textAlign: 'center', marginTop: spacing.xxl * 2 },
  more: { marginVertical: spacing.lg },
});
