import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { MasonryColumns } from '../../src/feed/masonry';
import { BlockButton } from '../../src/moderation/BlockButton';
import { ReportSheet } from '../../src/moderation/ReportSheet';
import { ProfileHero } from '../../src/profile/ProfileHero';
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
  const [reportOpen, setReportOpen] = useState(false);

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

        <ProfileHero
          name={tailor.name}
          verified={tailor.profile?.verified}
          location={tailor.profile?.location}
          avatarUrl={tailor.avatarUrl}
          coverUrl={tailor.profile?.coverUrl}
          yearsExperience={tailor.profile?.yearsExperience}
          priceMin={tailor.profile?.priceMin}
          priceMax={tailor.profile?.priceMax}
          stats={[
            { label: 'Modèles', value: tailor.designsCount },
            { label: 'Abonnés', value: tailor.followersCount },
            { label: "J'aime", value: tailor.likesTotal },
          ]}
          bio={tailor.profile?.bio}
          specialties={tailor.profile?.specialties ?? []}
        />

        {canFollow ? (
          <>
            <Pressable
              style={[styles.follow, followedByMe && styles.followActive]}
              onPress={() => toggleFollow(followedByMe)}
              disabled={following}
            >
              <Text style={[styles.followText, followedByMe && styles.followTextActive]}>
                {followedByMe ? 'Abonné' : 'Suivre'}
              </Text>
            </Pressable>
            <BlockButton userId={tailor.id} />
            <Pressable style={styles.reportLink} onPress={() => setReportOpen(true)}>
              <Feather name="flag" size={13} color={colors.textOnDarkMuted} />
              <Text style={styles.reportText}>Signaler</Text>
            </Pressable>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Ses modèles</Text>
        {designs.length === 0 ? (
          <Text style={styles.empty}>Aucun modèle publié pour l'instant.</Text>
        ) : (
          <MasonryColumns designs={designs} onOpen={(d) => router.push(`/design/${d}`)} />
        )}
      </ScrollView>

      <ReportSheet
        visible={reportOpen}
        targetType="USER"
        targetId={tailor.id}
        onClose={() => setReportOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: { paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  follow: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
  },
  followActive: { backgroundColor: colors.inkElevated, borderWidth: 1, borderColor: colors.inkLine },
  followText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
  followTextActive: { color: colors.textOnDarkMuted },
  reportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md, paddingVertical: spacing.xs },
  reportText: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 13 },
  sectionTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 16, marginBottom: spacing.md, paddingHorizontal: spacing.xs },
  empty: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 14, paddingHorizontal: spacing.xs },
});
