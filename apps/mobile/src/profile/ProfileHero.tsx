import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

type Stat = { label: string; value: number };
type Props = {
  name: string;
  roleLabel?: string;
  location?: string | null;
  verified?: boolean;
  stats?: Stat[];
  bio?: string | null;
  specialties?: string[];
  avatarUrl?: string | null;
  coverUrl?: string | null;
  yearsExperience?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
};

/** Prix affiché en FCFA : « À partir de … », « … – … » ou « Jusqu'à … ». */
function formatPrice(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => n.toLocaleString('fr-FR');
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)} FCFA`;
  if (min != null) return `À partir de ${fmt(min)} FCFA`;
  return `Jusqu'à ${fmt(max as number)} FCFA`;
}

export function ProfileHero({
  name,
  roleLabel,
  location,
  verified,
  stats,
  bio,
  specialties,
  avatarUrl,
  coverUrl,
  yearsExperience,
  priceMin,
  priceMax,
}: Props) {
  const initial = name.trim().charAt(0).toUpperCase();
  const price = formatPrice(priceMin, priceMax);
  return (
    <View style={styles.hero}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />
      ) : (
        <View style={[styles.cover, styles.coverFallback]} />
      )}

      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      <View style={styles.nameRow}>
        <Text style={styles.name}>{name}</Text>
        {verified ? <Feather name="check-circle" size={18} color={colors.accent} /> : null}
      </View>

      {roleLabel ? (
        <View style={styles.roleChip}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      ) : null}

      {location ? (
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={13} color={colors.textOnDarkMuted} />
          <Text style={styles.location}>{location}</Text>
        </View>
      ) : null}

      {yearsExperience != null ? (
        <Text style={styles.meta}>{yearsExperience} ans d'expérience</Text>
      ) : null}

      {price ? <Text style={styles.meta}>{price}</Text> : null}

      {stats && stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map((s, i) => (
            <View key={s.label} style={styles.statWrap}>
              {i > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.stat}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {bio ? <Text style={styles.bio}>{bio}</Text> : null}

      {specialties && specialties.length > 0 ? (
        <View style={styles.specialties}>
          {specialties.map((s) => (
            <View key={s} style={styles.specChip}>
              <Text style={styles.specText}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const AVATAR = 92;

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  cover: {
    width: '100%',
    height: 140,
    borderRadius: radius.lg,
    marginBottom: -AVATAR / 2,
  },
  coverFallback: { backgroundColor: colors.inkElevated },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  avatarFallback: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 38 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.textOnDark, fontFamily: fonts.display, fontSize: 26 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.accentSoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  roleText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  location: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 14 },
  meta: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.xs },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  statWrap: { flexDirection: 'row', alignItems: 'center' },
  stat: { alignItems: 'center', paddingHorizontal: spacing.xl },
  statValue: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 22 },
  statLabel: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.inkLine },
  bio: {
    color: colors.textOnDark,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  specialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  specChip: {
    backgroundColor: colors.accentSoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  specText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 12 },
});
