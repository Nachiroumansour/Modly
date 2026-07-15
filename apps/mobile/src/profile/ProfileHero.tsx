import { Feather } from '@expo/vector-icons';
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
};

export function ProfileHero({ name, roleLabel, location, verified, stats, bio, specialties }: Props) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <View style={styles.hero}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
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

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.lg },
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
