import type { DesignCategory } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_LABELS, DESIGN_CATEGORIES } from '../src/designs/categories';
import { usePublishDesign } from '../src/designs/hooks';
import { colors, fonts, radius, spacing } from '../src/theme';
import { Button } from '../src/ui/Button';

export default function Publish() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { publish, publishing } = usePublishDesign();
  const [uris, setUris] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DesignCategory | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Autorise l’accès aux photos pour choisir des images.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.9,
    });
    if (!res.canceled) {
      setUris(res.assets.slice(0, 5).map((a) => a.uri));
    }
  }

  async function submit() {
    setError(null);
    if (uris.length === 0) return setError('Ajoute au moins une photo du modèle.');
    if (title.trim().length === 0) return setError('Donne un titre à ton modèle.');
    if (!category) return setError('Choisis une catégorie.');
    try {
      await publish({ uris, title: title.trim(), category, description: description.trim() || undefined });
      router.replace('/(tabs)/profile');
    } catch {
      setError('La publication a échoué. Réessaie.');
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Publier un modèle</Text>
          <View style={{ width: 26 }} />
        </View>

        <Pressable style={styles.picker} onPress={pickImages}>
          {uris.length > 0 ? (
            <Image source={{ uri: uris[0] }} style={styles.preview} contentFit="cover" />
          ) : (
            <View style={styles.pickerEmpty}>
              <Feather name="camera" size={28} color={colors.accent} />
              <Text style={styles.pickerText}>Ajouter des photos (jusqu’à 5)</Text>
            </View>
          )}
        </Pressable>
        {uris.length > 1 ? (
          <View style={styles.thumbs}>
            {uris.map((u, i) => (
              <Image key={u + i} source={{ uri: u }} style={styles.thumb} contentFit="cover" />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.label}>Titre</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Boubou brodé, Robe wax…"
            placeholderTextColor={colors.textOnDarkMuted}
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.chips}>
            {DESIGN_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                  {CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description (optionnel)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Tissu, coupe, détails…"
            placeholderTextColor={colors.textOnDarkMuted}
            style={[styles.input, styles.inputMulti]}
            multiline
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Publier le modèle" onPress={submit} loading={publishing} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  picker: {
    marginHorizontal: spacing.lg,
    height: 260,
    borderRadius: radius.lg,
    backgroundColor: colors.inkElevated,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.inkLine,
  },
  preview: { width: '100%', height: '100%' },
  thumbs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' },
  thumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.inkElevated },
  pickerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  pickerText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  label: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  inputMulti: { height: 100, paddingTop: spacing.md, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.inkElevated,
  },
  chipActive: { backgroundColor: colors.accentSoft },
  chipText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 13 },
  chipTextActive: { color: colors.accent },
  error: { color: colors.accent, fontFamily: fonts.bodyBold, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.inkLine,
  },
});
