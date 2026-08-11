import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CollectionCard } from '../../src/collections/CollectionCard';
import { useCollections, useCreateCollection } from '../../src/collections/hooks';
import { useBookmarks } from '../../src/feed/useBookmarks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { AppHeader } from '../../src/ui/AppHeader';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

export default function SavedTab() {
  const router = useRouter();
  const { designs, isLoading, isError, refetch } = useBookmarks();
  const { collections } = useCollections();
  const { create, creating } = useCreateCollection();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  async function submitName() {
    const n = name.trim();
    if (n.length === 0) return;
    try {
      await create(n);
    } catch {
      // nom déjà pris : on ferme quand même, l'erreur est visible via la liste inchangée
    }
    setName('');
    setNaming(false);
  }

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

  const allCovers = designs.slice(0, 4).map((d) => d.imageUrl);
  const empty = collections.length === 0 && designs.length === 0;

  return (
    <View style={styles.outer}>
      <AppHeader />
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={styles.title}>Enregistrés</Text>
          <Pressable style={styles.newBtn} onPress={() => setNaming(true)} hitSlop={8}>
            <Feather name="plus" size={16} color={colors.textOnDark} />
            <Text style={styles.newText}>Collection</Text>
          </Pressable>
        </View>

        {empty ? (
          <View style={styles.emptyBox}>
            <View style={styles.badge}>
              <Feather name="bookmark" size={26} color={colors.accent} />
            </View>
            <Text style={styles.emptyText}>
              Enregistre des modèles et range-les dans des collections (Mariage, Boubous…).
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            <View style={styles.cell}>
              <CollectionCard
                name="Tous les enregistrés"
                count={designs.length}
                covers={allCovers}
                onPress={() => router.push('/saved-all')}
              />
            </View>
            {collections.map((c) => (
              <View key={c.id} style={styles.cell}>
                <CollectionCard
                  name={c.name}
                  count={c.count}
                  covers={c.covers}
                  onPress={() => router.push(`/collection/${c.id}`)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={naming} transparent animationType="fade" onRequestClose={() => setNaming(false)}>
        <Pressable style={styles.mBackdrop} onPress={() => setNaming(false)} />
        <View style={styles.mWrap}>
          <View style={styles.mCard}>
            <Text style={styles.mTitle}>Nouvelle collection</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Mariage, Boubous..."
              placeholderTextColor={colors.textOnDarkMuted}
              style={styles.mInput}
              autoFocus
              maxLength={40}
            />
            <Pressable style={styles.mCta} onPress={submitName} disabled={creating}>
              <Text style={styles.mCtaText}>Créer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.ink },
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
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  newText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47%', flexGrow: 1 },
  emptyBox: { alignItems: 'center', marginTop: spacing.xxl * 2, gap: spacing.md, paddingHorizontal: spacing.xl },
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
  mBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  mWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  mCard: { backgroundColor: colors.inkElevated, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  mTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  mInput: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  mCta: { height: 50, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  mCtaText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
});
