import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import type { CollectionSummary } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  collections: CollectionSummary[];
  onPick: (collectionId: string | null) => void;
  onCreate: (name: string) => void;
};

export function CollectionPickerSheet({ visible, onClose, collections, onPick, onCreate }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  function submitNew() {
    const n = name.trim();
    if (n.length === 0) return;
    onCreate(n);
    setName('');
    setCreating(false);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable testID="picker-backdrop" style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Ranger dans…</Text>

          <ScrollView style={styles.list}>
            {collections.map((c) => (
              <Pressable key={c.id} testID={`picker-${c.id}`} style={styles.row} onPress={() => onPick(c.id)}>
                <View style={styles.rowIcon}>
                  <Feather name="folder" size={16} color={colors.accent} />
                </View>
                <Text style={styles.rowName}>{c.name}</Text>
                <Text style={styles.rowCount}>{c.count}</Text>
              </Pressable>
            ))}
            <Pressable testID="picker-remove" style={styles.row} onPress={() => onPick(null)}>
              <View style={styles.rowIcon}>
                <Feather name="bookmark" size={16} color={colors.textOnDarkMuted} />
              </View>
              <Text style={styles.rowName}>Non classé</Text>
            </Pressable>
          </ScrollView>

          {creating ? (
            <View style={styles.newRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nom de la collection"
                placeholderTextColor={colors.textOnDarkMuted}
                style={styles.input}
                autoFocus
                maxLength={40}
              />
              <Pressable style={styles.send} onPress={submitNew}>
                <Feather name="check" size={18} color={colors.textOnDark} />
              </Pressable>
            </View>
          ) : (
            <Pressable testID="picker-new" style={styles.newBtn} onPress={() => setCreating(true)}>
              <Feather name="plus" size={16} color={colors.accent} />
              <Text style={styles.newText}>Nouvelle collection</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.inkElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.inkLine, marginBottom: spacing.md },
  title: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 16, marginBottom: spacing.sm },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { flex: 1, color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
  rowCount: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 13 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  send: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.sm },
  newText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 15 },
});
