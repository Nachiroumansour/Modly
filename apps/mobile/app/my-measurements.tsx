import { MEASUREMENT_FIELDS } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyMeasurements, type LinkedMeasurement } from '../src/clients/hooks';
import { useSelfMeasurement } from '../src/measurements/self';
import type { SelfMeasurement } from '../src/types';
import { colors, fonts, radius, spacing } from '../src/theme';
import { ErrorRetry } from '../src/ui/ErrorRetry';

export default function MyMeasurements() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { records, isLoading, isError, refetch } = useMyMeasurements();
  const { measurement } = useSelfMeasurement();

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={[styles.root, styles.center]}>
        <ErrorRetry message="Impossible de charger tes mesures." onRetry={refetch} dark />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.textOnDark} />
        </Pressable>
        <Text style={styles.headerTitle}>Mes mesures</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>Mes mesures personnelles</Text>
          <Pressable style={styles.editBtn} onPress={() => router.push('/self-measurement')} hitSlop={8}>
            <Feather name={measurement ? 'edit-3' : 'plus'} size={14} color={colors.accent} />
            <Text style={styles.editText}>{measurement ? 'Modifier' : 'Ajouter'}</Text>
          </Pressable>
        </View>

        {measurement ? (
          <MeasureGrid measurement={measurement} />
        ) : (
          <Pressable style={styles.addCard} onPress={() => router.push('/self-measurement')}>
            <Feather name="sliders" size={22} color={colors.accent} />
            <Text style={styles.addText}>Ajoute tes mesures pour gagner du temps a la commande.</Text>
          </Pressable>
        )}

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>Prises par tes tailleurs</Text>
        {records.length === 0 ? (
          <Text style={styles.noMeasure}>Aucun tailleur n'a encore pris tes mesures.</Text>
        ) : (
          records.map((r) => <MeasureCard key={r.id} record={r} />)
        )}
      </ScrollView>
    </View>
  );
}

function MeasureGrid({ measurement }: { measurement: SelfMeasurement }) {
  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        {MEASUREMENT_FIELDS.filter((f) => measurement[f.key] != null).map((f) => (
          <View key={f.key} style={styles.measure}>
            <Text style={styles.measureLabel}>{f.label}</Text>
            <Text style={styles.measureValue}>{measurement[f.key]} cm</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MeasureCard({ record }: { record: LinkedMeasurement }) {
  const m = record.latestMeasurement;
  return (
    <View style={styles.card}>
      <Text style={styles.tailor}>Prises par {record.tailor.name}</Text>
      {m ? (
        <View style={styles.grid}>
          {MEASUREMENT_FIELDS.filter((f) => m[f.key] != null).map((f) => (
            <View key={f.key} style={styles.measure}>
              <Text style={styles.measureLabel}>{f.label}</Text>
              <Text style={styles.measureValue}>{m[f.key]} cm</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noMeasure}>Pas encore de mesures.</Text>
      )}
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
  headerTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionLabel: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSpacer: { marginTop: spacing.xl, marginBottom: spacing.sm },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  addText: { flex: 1, color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tailor: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 14, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  measure: { backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  measureLabel: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 11 },
  measureValue: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15, marginTop: 2 },
  noMeasure: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 14 },
});
