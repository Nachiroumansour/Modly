import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection, useDeleteCollection, useRenameCollection } from '../../src/collections/hooks';
import { MasonryColumns } from '../../src/feed/masonry';
import { colors, fonts, radius, spacing } from '../../src/theme';

export default function CollectionDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { collection, designs, isLoading } = useCollection(id);
  const { rename, renaming } = useRenameCollection();
  const { remove } = useDeleteCollection();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  async function submitRename() {
    const n = name.trim();
    if (n.length === 0) return;
    try {
      await rename(id, n);
    } catch {
      // nom déjà pris : on ferme
    }
    setEditing(false);
  }

  async function confirmDelete() {
    setMenu(false);
    await remove(id);
    router.back();
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.textOnDark} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {collection?.name ?? 'Collection'}
        </Text>
        <Pressable onPress={() => setMenu(true)} hitSlop={10}>
          <Feather name="more-horizontal" size={22} color={colors.textOnDark} />
        </Pressable>
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
            <Text style={styles.empty}>Range des modèles ici depuis tes enregistrés.</Text>
          ) : (
            <MasonryColumns designs={designs} onOpen={(d) => router.push(`/design/${d}`)} />
          )}
        </ScrollView>
      )}

      {/* Menu actions */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <Pressable
              style={styles.action}
              onPress={() => {
                setMenu(false);
                setName(collection?.name ?? '');
                setEditing(true);
              }}
            >
              <Feather name="edit-3" size={18} color={colors.textOnDark} />
              <Text style={styles.actionText}>Renommer</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={confirmDelete}>
              <Feather name="trash-2" size={18} color={colors.danger} />
              <Text style={[styles.actionText, { color: colors.danger }]}>Supprimer la collection</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Renommer */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(false)} />
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Renommer</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.textOnDarkMuted}
              style={styles.input}
              autoFocus
              maxLength={40}
            />
            <Pressable style={styles.cta} onPress={submitRename} disabled={renaming}>
              <Text style={styles.ctaText}>Enregistrer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    gap: spacing.md,
  },
  title: { flex: 1, color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17, textAlign: 'center' },
  empty: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.inkElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  actionText: { color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
  centerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  card: { backgroundColor: colors.inkElevated, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  input: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  cta: { height: 50, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
});
