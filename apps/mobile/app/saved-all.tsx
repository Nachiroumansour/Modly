import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CollectionPickerSheet } from '../src/collections/CollectionPickerSheet';
import { useCollections, useCreateCollection, useMoveBookmark } from '../src/collections/hooks';
import { MasonryColumns } from '../src/feed/masonry';
import { useBookmarks } from '../src/feed/useBookmarks';
import { colors, fonts, spacing } from '../src/theme';

export default function SavedAll() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { designs, isLoading } = useBookmarks();
  const { collections } = useCollections();
  const { move } = useMoveBookmark();
  const { create } = useCreateCollection();
  const [target, setTarget] = useState<string | null>(null);

  function pick(collectionId: string | null) {
    if (target) move(target, collectionId);
    setTarget(null);
  }
  async function createAndFile(name: string) {
    if (!target) return;
    const designId = target;
    setTarget(null);
    try {
      const res = await create(name);
      await move(designId, res.collection.id);
    } catch {
      // nom déjà pris : ignoré
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.textOnDark} />
        </Pressable>
        <Text style={styles.title}>Tous les enregistrés</Text>
        <View style={{ width: 26 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
          showsVerticalScrollIndicator={false}
        >
          {designs.length === 0 ? (
            <Text style={styles.empty}>Touche le marque-page sur un modèle pour le retrouver ici.</Text>
          ) : (
            <>
              <Text style={styles.hint}>Appui long sur un modèle pour le ranger dans une collection.</Text>
              <MasonryColumns
                designs={designs}
                onOpen={(id) => router.push(`/design/${id}`)}
                onLongPress={(id) => setTarget(id)}
              />
            </>
          )}
        </ScrollView>
      )}

      <CollectionPickerSheet
        visible={Boolean(target)}
        onClose={() => setTarget(null)}
        collections={collections}
        onPick={pick}
        onCreate={createAndFile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  hint: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  empty: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
});
