import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { colors, fonts, radius, spacing } from '../theme';
import { AuthCollage } from './AuthCollage';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthCollage>
          <Text style={styles.wordmark}>Modly</Text>
          <Text style={styles.tagline}>Crée la mode que tu aimes.</Text>
        </AuthCollage>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Button label="S'inscrire" onPress={() => router.push('/(auth)/signup')} style={styles.cta} />
          <Button
            label="Se connecter"
            onPress={() => router.push('/(auth)/login')}
            style={[styles.cta, styles.ctaGrey]}
          />
          <Text style={styles.terms}>
            En continuant, tu acceptes les Conditions d'utilisation de Modly et reconnais avoir lu la
            Politique de confidentialité.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1 },
  wordmark: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 48 },
  tagline: { color: colors.textOnDark, fontFamily: fonts.bodyRegular, fontSize: 17, opacity: 0.9, marginTop: spacing.xs },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.ink,
    marginTop: -radius.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  cta: { borderRadius: radius.pill },
  ctaGrey: { backgroundColor: colors.inkElevated },
  terms: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
