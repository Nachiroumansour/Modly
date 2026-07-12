import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { MasonryColumns } from '../../src/feed/masonry';
import { useFollow, useTailorProfile } from '../../src/tailors/hooks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

export default function TailorProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { tailor, designs, followedByMe, isLoading, isError, refetch } = useTailorProfile(id);
  const { toggleFollow, following } = useFollow(id);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError || !tailor) {
    return (
      <View style={[styles.root, styles.center]}>
        <ErrorRetry message="Tailleur introuvable." onRetry={refetch} dark />
      </View>
    );
  }

  const canFollow = Boolean(user) && user?.id !== tailor.id;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{tailor.name.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{tailor.name}</Text>
            {tailor.profile?.verified ? <Feather name="check-circle" size={18} color={colors.accent} /> : null}
          </View>
          {tailor.profile?.location ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={13} color={colors.textOnDarkMuted} />
              <Text style={styles.location}>{tailor.profile.location}</Text>
            </View>
          ) : null}

          <View style={styles.stats}>
            <Stat value={tailor.designsCount} label="Modèles" />
            <View style={styles.statDivider} />
            <Stat value={tailor.followersCount} label="Abonnés" />
          </View>

          {canFollow ? (
            <Pressable
              style={[styles.follow, followedByMe && styles.followActive]}
              onPress={() => toggleFollow(followedByMe)}
              disabled={following}
            >
              <Text style={[styles.followText, followedByMe && styles.followTextActive]}>
                {followedByMe ? 'Abonné' : 'Suivre'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {tailor.profile?.bio ? <Text style={styles.bio}>{tailor.profile.bio}</Text> : null}

        {tailor.profile && tailor.profile.specialties.length > 0 ? (
          <View style={styles.specialties}>
            {tailor.profile.specialties.map((s) => (
              <View key={s} style={styles.specChip}>
                <Text style={styles.specText}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Ses modèles</Text>
        {designs.length === 0 ? (
          <Text style={styles.empty}>Aucun modèle publié pour l'instant.</Text>
        ) : (
          <MasonryColumns designs={designs} onOpen={(d) => router.push(`/design/${d}`)} />
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: { paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 38 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.textOnDark, fontFamily: fonts.display, fontSize: 26 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  location: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 14 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginTop: spacing.lg },
  stat: { alignItems: 'center' },
  statValue: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 22 },
  statLabel: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.inkLine },
  follow: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
  },
  followActive: { backgroundColor: colors.inkElevated, borderWidth: 1, borderColor: colors.inkLine },
  followText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
  followTextActive: { color: colors.textOnDarkMuted },
  bio: {
    color: colors.textOnDark,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.lg },
  specChip: { backgroundColor: colors.accentSoft, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  specText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 12 },
  sectionTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 16, marginBottom: spacing.md, paddingHorizontal: spacing.xs },
  empty: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 14, paddingHorizontal: spacing.xs },
});
