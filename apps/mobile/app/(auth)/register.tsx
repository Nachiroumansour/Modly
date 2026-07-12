import type { Role } from '@moodly/shared';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiClientError } from '../../src/lib/api';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/TextField';
import { colors, fonts, radius, spacing } from '../../src/theme';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CLIENT');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await register({ phone, name, password, role });
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Inscription impossible. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Créer un compte</Text>
      <Text style={styles.subtitle}>30 secondes, c'est tout.</Text>

      <View style={styles.roleRow}>
        <RoleCard label="Je suis client" active={role === 'CLIENT'} onPress={() => setRole('CLIENT')} />
        <RoleCard label="Je suis tailleur" active={role === 'TAILLEUR'} onPress={() => setRole('TAILLEUR')} />
      </View>

      <TextField label="Prénom" value={name} onChangeText={setName} placeholder="Awa" />
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

      <Button label="Créer mon compte" onPress={onSubmit} loading={loading} />

      <Link href="/(auth)/login" style={styles.link}>
        <Text style={styles.linkText}>J'ai déjà un compte — me connecter</Text>
      </Link>
    </ScrollView>
  );
}

function RoleCard({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.roleCard, active && styles.roleCardActive]}>
      <Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xxl * 2, backgroundColor: colors.ink, flexGrow: 1 },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 34 },
  subtitle: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 16, marginTop: spacing.sm, marginBottom: spacing.xl },
  roleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  roleCard: {
    flex: 1,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkElevated,
    backgroundColor: colors.inkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  roleText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 15 },
  roleTextActive: { color: colors.accent },
  error: { color: colors.accent, marginBottom: spacing.md, fontFamily: fonts.bodyBold },
  link: { marginTop: spacing.xl, alignSelf: 'center' },
  linkText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold },
});
