import type { Role } from '@moodly/shared';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiClientError } from '../lib/api';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuth } from './AuthContext';
import { AuthCollage } from './AuthCollage';

export default function RegisterScreen() {
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
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthCollage>
          <Text style={styles.wordmark}>Modly</Text>
          <Text style={styles.tagline}>Rejoins la communauté mode.</Text>
        </AuthCollage>

        <View style={styles.sheet}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>30 secondes, c'est tout.</Text>

          <Text style={styles.roleLabel}>Je suis…</Text>
          <View style={styles.roleRow}>
            <RoleCard label="Client" hint="Je cherche des modèles" active={role === 'CLIENT'} onPress={() => setRole('CLIENT')} />
            <RoleCard label="Tailleur" hint="Je crée des modèles" active={role === 'TAILLEUR'} onPress={() => setRole('TAILLEUR')} />
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

          <Button label="Créer mon compte" onPress={onSubmit} loading={loading} style={styles.cta} />

          <Link href="/(auth)/login" style={styles.link}>
            <Text style={styles.linkText}>J'ai déjà un compte — me connecter</Text>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}

function RoleCard({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.roleCard, active && styles.roleCardActive]}>
      <Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
      <Text style={[styles.roleHint, active && styles.roleHintActive]}>{hint}</Text>
    </Pressable>
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
  roleLabel: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  roleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  roleCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkLine,
    backgroundColor: colors.inkElevated,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  roleCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  roleText: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  roleTextActive: { color: colors.accent },
  roleHint: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 12 },
  roleHintActive: { color: colors.accent, opacity: 0.85 },
  error: { color: colors.accent, marginBottom: spacing.md, fontFamily: fonts.bodyBold },
  cta: { borderRadius: radius.pill, marginTop: spacing.sm },
  link: { marginTop: spacing.xl, alignSelf: 'center', marginBottom: spacing.xl },
  linkText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold },
});
