import { MEASUREMENT_FIELDS } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyMeasurements, type LinkedMeasurement } from '../src/clients/hooks';
import { colors, fonts, radius, spacing } from '../src/theme';
import { ErrorRetry } from '../src/ui/ErrorRetry';

export default function MyMeasurements() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { records, isLoading, isError, refetch } = useMyMeasurements();

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
        {records.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.badge}>
              <Feather name="sliders" size={26} color={colors.accent} />
            </View>
            <Text style={styles.emptyText}>
              Quand un tailleur prendra tes mesures, tu les retrouveras ici.
            </Text>
          </View>
        ) : (
          records.map((r) => <MeasureCard key={r.id} record={r} />)
        )}
      </ScrollView>
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
  empty: { alignItems: 'center', marginTop: spacing.xxl * 2, gap: spacing.md, paddingHorizontal: spacing.xl },
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
});
