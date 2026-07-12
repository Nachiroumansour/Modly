import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesign } from '../../src/design/useDesign';
import { useCreateOrder } from '../../src/orders/hooks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

export default function CreateOrder() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { designId } = useLocalSearchParams<{ designId: string }>();
  const { design, isLoading, isError, refetch } = useDesign(designId);
  const { createOrder, creating } = useCreateOrder();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!design) return;
    setError(null);
    try {
      const { order } = await createOrder({
        tailorId: design.tailor.id,
        designId: design.id,
        note: note.trim() || undefined,
      });
      router.replace(`/orders/${order.id}`);
    } catch {
      setError("La commande n'a pas pu être créée. Réessaie.");
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError || !design) {
    return (
      <View style={[styles.root, styles.center]}>
        <ErrorRetry message="Modèle introuvable." onRetry={refetch} dark />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Commander</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.model}>
          <Image source={{ uri: design.imageUrl }} style={styles.thumb} contentFit="cover" />
          <View style={styles.modelBody}>
            <Text style={styles.modelTitle}>{design.title}</Text>
            <Text style={styles.modelTailor}>par {design.tailor.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Ta demande</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Couleurs, tissu, occasion, délai souhaité…"
            placeholderTextColor={colors.textOnDarkMuted}
            style={styles.input}
            multiline
          />
          <Text style={styles.hint}>
            Le tailleur confirmera le prix et prendra tes mesures. Tu suivras chaque étape ici.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Envoyer la commande" onPress={confirm} loading={creating} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  model: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  thumb: { width: 66, height: 84, borderRadius: radius.sm, backgroundColor: colors.inkLine },
  modelBody: { flex: 1, gap: 4 },
  modelTitle: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 16 },
  modelTailor: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 },
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
    minHeight: 120,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    color: colors.textOnDark,
    padding: spacing.md,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  hint: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  error: { color: colors.accent, fontFamily: fonts.bodyBold, textAlign: 'center', marginTop: spacing.lg },
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
