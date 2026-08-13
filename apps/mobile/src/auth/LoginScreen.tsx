import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiClientError } from '../lib/api';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuth } from './AuthContext';
import { AuthCollage } from './AuthCollage';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login(phone, password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Connexion impossible. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthCollage>
          <Text style={styles.wordmark}>Modly</Text>
          <Text style={styles.tagline}>La mode sur mesure, inspirée.</Text>
        </AuthCollage>

        <View style={styles.sheet}>
          <Text style={styles.title}>Se connecter</Text>
          <Text style={styles.subtitle}>Content de te revoir.</Text>

          <TextField
            label="Téléphone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+221 77 000 00 00"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Me connecter" onPress={onSubmit} loading={loading} style={styles.cta} />

          <Link href="/(auth)/register" style={styles.link}>
            <Text style={styles.linkText}>Pas encore de compte — créer un compte</Text>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1 },
  wordmark: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 44 },
  tagline: { color: colors.textOnDark, fontFamily: fonts.bodyRegular, fontSize: 16, opacity: 0.9, marginTop: spacing.xs },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.ink,
    marginTop: -radius.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingTop: spacing.xl,
  },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 28 },
  subtitle: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  error: { color: colors.accent, marginBottom: spacing.md, fontFamily: fonts.bodyBold },
  cta: { borderRadius: radius.pill, marginTop: spacing.sm },
  link: { marginTop: spacing.xl, alignSelf: 'center' },
  linkText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold },
});
