import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiClientError } from '../../src/lib/api';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/TextField';
import { colors, spacing, typography } from '../../src/theme';

export default function Login() {
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

      <Button label="Me connecter" onPress={onSubmit} loading={loading} />

      <Link href="/(auth)/register" style={styles.link}>
        <Text style={styles.linkText}>Pas encore de compte — créer un compte</Text>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xxl * 2, backgroundColor: colors.ink, flexGrow: 1 },
  title: { color: colors.textOnDark, fontSize: typography.display.fontSize, fontWeight: '800' },
  subtitle: {
    color: colors.textOnDarkMuted,
    fontSize: typography.body.fontSize,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  error: { color: colors.accent, marginBottom: spacing.md, fontWeight: '600' },
  link: { marginTop: spacing.xl, alignSelf: 'center' },
  linkText: { color: colors.textOnDarkMuted, fontWeight: '600' },
});
