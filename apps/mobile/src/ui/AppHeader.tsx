import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, fonts, spacing } from '../theme';

/** Header permanent affiché en haut de chaque écran d'onglet. */
export function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isTailor = user?.role === 'TAILLEUR';

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.logo}>Modly</Text>
      <View style={styles.actions}>
        {isTailor ? (
          <Pressable testID="header-clients" hitSlop={10} onPress={() => router.push('/clients')}>
            <Feather name="users" size={22} color={colors.textOnDark} />
          </Pressable>
        ) : null}
        <Pressable testID="header-notifications" hitSlop={10} onPress={() => router.push('/notifications')}>
          <Feather name="bell" size={22} color={colors.textOnDark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.ink,
  },
  logo: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 24 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
