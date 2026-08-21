import type { DesignCategory, PostType } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_LABELS, DESIGN_CATEGORIES } from '../designs/categories';
import { usePublishDesign } from '../designs/hooks';
import { colors, fonts, radius, spacing } from '../theme';
import { Button } from '../ui/Button';

const STEPS = ['media', 'essentiel', 'finitions'] as const;
type Step = (typeof STEPS)[number];

export default function PublishWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { publish, publishing } = usePublishDesign();

  const [step, setStep] = useState(0);
  const [uris, setUris] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DesignCategory | null>(null);
  const [description, setDescription] = useState('');
  const [postType, setPostType] = useState<PostType>('INSPIRATION');
  const [sourceCredit, setSourceCredit] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current: Step = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const canAdvance =
    (current === 'media' && uris.length >= 1) ||
    (current === 'essentiel' && title.trim().length > 0 && category !== null) ||
    current === 'finitions';

  async function pickImages() {
    setError(null);
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

  // La galerie s'ouvre directement au montage (tap ⊕ Publier). Si l'utilisateur
  // annule sans rien choisir, l'écran d'accueil engageant reste affiché.
  useEffect(() => {
    void pickImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function back() {
    setError(null);
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  async function next() {
    if (!canAdvance) return;
    setError(null);
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    try {
      await publish({
        uris,
        title: title.trim(),
        category: category!,
        description: description.trim() || undefined,
        postType,
        sourceCredit: postType === 'INSPIRATION' && sourceCredit.trim() ? sourceCredit.trim() : undefined,
      });
      router.replace('/(tabs)/profile');
    } catch {
      setError('La publication a échoué. Réessaie.');
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityLabel="Retour">
          <Feather name="chevron-left" size={28} color={colors.textOnDark} />
        </Pressable>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {current === 'media' && (
          <>
            <Text style={styles.title}>Tes photos</Text>
            {uris.length > 0 ? (
              <>
                <Image source={{ uri: uris[0] }} style={styles.cover} contentFit="cover" />
                <View style={styles.thumbs}>
                  {uris.map((u, i) => (
                    <Pressable
                      key={u + i}
                      testID="remove-thumb"
                      onPress={() => setUris((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Image source={{ uri: u }} style={styles.thumb} contentFit="cover" />
                      <View style={styles.thumbRemove}>
                        <Feather name="x" size={12} color={colors.textOnDark} />
                      </View>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={styles.addMore} onPress={pickImages}>
                  <Feather name="plus" size={16} color={colors.accent} />
                  <Text style={styles.addMoreText}>Ajouter / remplacer</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.emptyPicker} onPress={pickImages}>
                <Feather name="camera" size={30} color={colors.accent} />
                <Text style={styles.emptyText}>Choisir des photos</Text>
                <Text style={styles.emptyHint}>Jusqu’à 5 · la 1re sera la couverture</Text>
              </Pressable>
            )}
          </>
        )}

        {current === 'essentiel' && (
          <>
            <Text style={styles.title}>L'essentiel</Text>
            <Text style={styles.label}>Titre</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Boubou brodé, Robe wax…"
              placeholderTextColor={colors.textOnDarkMuted}
              style={styles.input}
              autoFocus
              maxLength={120}
            />
            <Text style={[styles.label, { marginTop: spacing.xl }]}>Catégorie</Text>
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
          </>
        )}

        {current === 'finitions' && (
          <>
            <Text style={styles.title}>Finitions</Text>
            <Text style={styles.label}>Type de publication</Text>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentItem, postType === 'INSPIRATION' && styles.segmentItemActive]}
                onPress={() => setPostType('INSPIRATION')}
              >
                <Text style={[styles.segmentText, postType === 'INSPIRATION' && styles.segmentTextActive]}>
                  Inspiration
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segmentItem, postType === 'ORIGINAL' && styles.segmentItemActive]}
                onPress={() => setPostType('ORIGINAL')}
              >
                <Text style={[styles.segmentText, postType === 'ORIGINAL' && styles.segmentTextActive]}>
                  Création originale
                </Text>
              </Pressable>
            </View>
            {postType === 'INSPIRATION' ? (
              <>
                <Text style={styles.optionHint}>Contenu de découverte. Ajoute la source si tu la connais.</Text>
                <TextInput
                  value={sourceCredit}
                  onChangeText={setSourceCredit}
                  placeholder="Crédit ou lien (optionnel)"
                  placeholderTextColor={colors.textOnDarkMuted}
                  style={styles.input}
                  maxLength={200}
                />
              </>
            ) : (
              <Text style={styles.optionHint}>Ta création. Un filigrane © {'{'}atelier{'}'} protégera tes photos.</Text>
            )}

            <Text style={[styles.label, { marginTop: spacing.xl }]}>Description (optionnel)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tissu, coupe, détails…"
              placeholderTextColor={colors.textOnDarkMuted}
              style={[styles.input, styles.inputMulti]}
              multiline
            />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label={isLast ? 'Publier' : 'Suivant'}
          onPress={next}
          disabled={!canAdvance}
          loading={publishing}
          style={styles.cta}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', height: 40 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkLine },
  dotActive: { width: 20, backgroundColor: colors.textOnDark },
  headerSpacer: { width: 28 },
  body: { paddingTop: spacing.xl, flexGrow: 1, paddingBottom: 120 },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 30, marginBottom: spacing.xl, lineHeight: 36 },
  emptyPicker: {
    height: 320,
    borderRadius: radius.lg,
    backgroundColor: colors.inkElevated,
    borderWidth: 1,
    borderColor: colors.inkLine,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 16 },
  emptyHint: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13 },
  cover: { width: '100%', height: 300, borderRadius: radius.lg, backgroundColor: colors.inkElevated },
  thumbs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  thumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.inkElevated },
  thumbRemove: {
    position: 'absolute',
    top: spacing.xs / 2,
    right: spacing.xs / 2,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(23,18,15,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMore: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  addMoreText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 14 },
  label: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 52,
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
  segment: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    borderWidth: 1,
    borderColor: colors.inkLine,
    alignItems: 'center',
  },
  segmentItemActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  segmentText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  segmentTextActive: { color: colors.accent },
  optionHint: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13, marginBottom: spacing.md },
  error: { color: colors.accent, fontFamily: fonts.bodyBold, textAlign: 'center', marginTop: spacing.lg },
  footer: { paddingTop: spacing.md },
  cta: { borderRadius: radius.pill },
});
