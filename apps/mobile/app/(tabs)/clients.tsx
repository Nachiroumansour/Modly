import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientRecords } from '../../src/clients/hooks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import type { ClientRecord } from '../../src/types';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

export default function ClientsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { records, isLoading, isError, refetch } = useClientRecords();

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
        <ErrorRetry message="Impossible de charger tes clients." onRetry={refetch} dark />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={styles.title}>Mes clients</Text>
        <Pressable style={styles.add} onPress={() => router.push('/client/create')}>
          <Feather name="plus" size={18} color={colors.textOnDark} />
          <Text style={styles.addText}>Nouveau</Text>
        </Pressable>
      </View>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.badge}>
            <Feather name="users" size={26} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>Ajoute ta première fiche client pour enregistrer ses mesures.</Text>
          <Pressable style={styles.cta} onPress={() => router.push('/client/create')}>
            <Text style={styles.ctaText}>Ajouter un client</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {records.map((r) => (
            <ClientRow key={r.id} record={r} onPress={() => router.push(`/client/${r.id}`)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ClientRow({ record, onPress }: { record: ClientRecord; onPress: () => void }) {
  const initial = record.name.trim().charAt(0).toUpperCase();
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {record.name}
        </Text>
        {record.phone ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {record.phone}
          </Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={20} color={colors.textOnDarkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 30 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  addText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 20 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 16 },
  rowMeta: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 13 },
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
  cta: { marginTop: spacing.sm, backgroundColor: colors.accent, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md },
  ctaText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
});
