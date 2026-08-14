import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { ProfileHero } from '../../src/profile/ProfileHero';
import { TailorProfileBody } from '../../src/profile/TailorProfileBody';
import { useTailorProfile } from '../../src/tailors/hooks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { AppHeader } from '../../src/ui/AppHeader';

type FeatherName = keyof typeof Feather.glyphMap;

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { tailor, designs } = useTailorProfile(user?.role === 'TAILLEUR' ? (user.id as string) : '');

  if (!user) {
    return (
      <View style={styles.outer}>
        <AppHeader />
        <View style={[styles.root, styles.guest]}>
          <View style={styles.guestInner}>
            <Text style={styles.guestTitle}>Rejoins Moodly</Text>
            <Text style={styles.guestText}>
              Crée ton compte pour commander, sauvegarder tes modèles préférés et suivre tes tailleurs.
            </Text>
            <Pressable style={styles.primary} onPress={() => router.push('/(auth)/welcome')}>
              <Text style={styles.primaryText}>Créer un compte</Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.ghostText}>J'ai déjà un compte</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <AppHeader />
      <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: spacing.xl, paddingBottom: 110 }}>
        {user.role === 'TAILLEUR' ? (
          <>
            <ProfileHero
              name={user.name}
              verified={tailor?.profile?.verified}
              location={tailor?.profile?.location}
              avatarUrl={tailor?.avatarUrl}
              coverUrl={tailor?.profile?.coverUrl}
              yearsExperience={tailor?.profile?.yearsExperience}
              priceMin={tailor?.profile?.priceMin}
              priceMax={tailor?.profile?.priceMax}
              stats={[
                { label: 'Modèles', value: tailor?.designsCount ?? 0 },
                { label: 'Abonnés', value: tailor?.followersCount ?? 0 },
                { label: "J'aime", value: tailor?.likesTotal ?? 0 },
              ]}
              bio={tailor?.profile?.bio}
              specialties={tailor?.profile?.specialties ?? []}
            />
            <Pressable style={styles.editBtn} onPress={() => router.push('/profile/edit')}>
              <Feather name="edit-2" size={15} color={colors.textOnDark} />
              <Text style={styles.editText}>Modifier le profil</Text>
            </Pressable>
          </>
        ) : (
          <ProfileHero name={user.name} roleLabel="Client" />
        )}

        <View style={styles.list}>
          {user.role === 'CLIENT' ? (
            <Row icon="sliders" label="Mes mesures" onPress={() => router.push('/my-measurements')} />
          ) : null}
          <Row icon="bell" label="Notifications" soon />
          <Row icon="help-circle" label="Aide" soon />
        </View>

        {user.role === 'TAILLEUR' ? (
          <TailorProfileBody
            designs={designs}
            onPublish={() => router.push('/publish')}
            onOpenClients={() => router.push('/clients')}
            onOpenDesign={(id) => router.push(`/design/${id}`)}
          />
        ) : null}

        <Pressable style={styles.logout} onPress={logout}>
          <Feather name="log-out" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  soon,
  onPress,
}: {
  icon: FeatherName;
  label: string;
  soon?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={18} color={colors.textOnDark} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {soon ? <Text style={styles.soon}>Bientôt</Text> : null}
      <Feather name="chevron-right" size={18} color={colors.textOnDarkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.ink },
  root: { flex: 1, backgroundColor: colors.ink },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.inkElevated,
    borderWidth: 1,
    borderColor: colors.inkLine,
  },
  editText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  list: { paddingHorizontal: spacing.lg, gap: 2, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
  soon: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 11, marginRight: spacing.xs },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkLine,
  },
  logoutText: { color: colors.danger, fontFamily: fonts.bodyBold, fontSize: 15 },
  guest: { justifyContent: 'center' },
  guestInner: { padding: spacing.xl, gap: spacing.md },
  guestTitle: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 34 },
  guestText: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  primary: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 16 },
  ghost: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: colors.textOnDark, fontFamily: fonts.body, fontSize: 15 },
});
