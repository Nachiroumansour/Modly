import { MEASUREMENT_FIELDS } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientMeasurements, useClientRecord } from '../../src/clients/hooks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import type { Measurement } from '../../src/types';
import { Button } from '../../src/ui/Button';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function filledCount(m: Measurement): number {
  return MEASUREMENT_FIELDS.filter((f) => m[f.key] != null).length;
}

export default function ClientDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { record, latestMeasurement, isLoading, isError, refetch } = useClientRecord(id);
  const { measurements } = useClientMeasurements(id);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError || !record) {
    return (
      <View style={[styles.root, styles.center]}>
        <ErrorRetry message="Fiche introuvable." onRetry={refetch} dark />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 110 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{record.name.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{record.name}</Text>
          {record.phone ? <Text style={styles.phone}>{record.phone}</Text> : null}
        </View>

        {(record.stylePref || record.tissuPref || record.notes) ? (
          <View style={styles.card}>
            {record.stylePref ? <Detail label="Style" value={record.stylePref} /> : null}
            {record.tissuPref ? <Detail label="Tissu" value={record.tissuPref} /> : null}
            {record.notes ? <Detail label="Notes" value={record.notes} /> : null}
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Mesures</Text>
          {latestMeasurement ? (
            <Text style={styles.sectionMeta}>{filledCount(latestMeasurement)}/15 · {formatDate(latestMeasurement.createdAt)}</Text>
          ) : null}
        </View>

        {latestMeasurement ? (
          <View style={styles.measures}>
            {MEASUREMENT_FIELDS.filter((f) => latestMeasurement[f.key] != null).map((f) => (
              <View key={f.key} style={styles.measure}>
                <Text style={styles.measureLabel}>{f.label}</Text>
                <Text style={styles.measureValue}>{latestMeasurement[f.key]} cm</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noMeasures}>Aucune mesure enregistrée pour l'instant.</Text>
        )}

        <View style={styles.takeBtn}>
          <Button label="Prendre les mesures" onPress={() => router.push(`/measure/${id}`)} />
        </View>

        {measurements.length > 1 ? (
          <View style={styles.history}>
            <Text style={styles.sectionTitle}>Historique</Text>
            {measurements.map((m) => (
              <View key={m.id} style={styles.historyRow}>
                <Feather name="clock" size={14} color={colors.textOnDarkMuted} />
                <Text style={styles.historyText}>
                  {formatDate(m.createdAt)} · {filledCount(m)}/15 mesures
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 34 },
  name: { color: colors.textOnDark, fontFamily: fonts.display, fontSize: 26 },
  phone: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 15, marginTop: 2 },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  detail: { gap: 2 },
  detailLabel: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { color: colors.textOnDark, fontFamily: fonts.bodyRegular, fontSize: 15 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 16 },
  sectionMeta: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 12 },
  measures: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  measure: {
    backgroundColor: colors.inkElevated,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  measureLabel: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 11 },
  measureValue: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15, marginTop: 2 },
  noMeasures: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 14, paddingHorizontal: spacing.lg },
  takeBtn: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  history: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyText: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 13 },
});
