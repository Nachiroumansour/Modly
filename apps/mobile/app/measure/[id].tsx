import { MEASUREMENT_FIELDS, type MeasurementKey } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAddMeasurement, useClientRecord } from '../../src/clients/hooks';
import { measureStringsFrom, parseMeasureValues, type MeasureStrings } from '../../src/measurements/parse';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { Button } from '../../src/ui/Button';

export default function MeasureForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { latestMeasurement } = useClientRecord(id);
  const { addMeasurement, saving } = useAddMeasurement(id);
  const [values, setValues] = useState<MeasureStrings>(() => measureStringsFrom(latestMeasurement));
  const [error, setError] = useState<string | null>(null);

  function set(key: MeasurementKey, text: string) {
    setValues((prev) => ({ ...prev, [key]: text.replace(',', '.') }));
  }

  async function submit() {
    setError(null);
    const res = parseMeasureValues(values);
    if (!res.ok) return setError(res.error);
    try {
      await addMeasurement(res.payload);
      router.back();
    } catch {
      setError("L'enregistrement a échoué. Réessaie.");
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Prise de mesures</Text>
          <View style={{ width: 26 }} />
        </View>

        <Text style={styles.hint}>En centimètres. Renseigne les mesures que tu prends — les autres restent vides.</Text>

        <View style={styles.grid}>
          {MEASUREMENT_FIELDS.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label} numberOfLines={1}>
                {f.label}
              </Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={values[f.key] ?? ''}
                  onChangeText={(t) => set(f.key, t)}
                  placeholder="—"
                  placeholderTextColor={colors.textOnDarkMuted}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <Text style={styles.unit}>cm</Text>
              </View>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Enregistrer les mesures" onPress={submit} loading={saving} />
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
  hint: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.md },
  field: { width: '47%', flexGrow: 1 },
  label: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: 50,
    color: colors.textOnDark,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
  },
  unit: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 13 },
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
