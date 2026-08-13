import { Feather } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiClientError } from '../lib/api';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuth } from './AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login(phone.trim(), password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Connexion impossible. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer">
          <Feather name="x" size={26} color={colors.textOnDark} />
        </Pressable>
        <Text style={styles.headerTitle}>Se connecter</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Pressable
          style={styles.social}
          onPress={() => setNote('La connexion Google arrive bientôt. Utilise ton numéro pour l’instant.')}
        >
          <Feather name="chrome" size={20} color={colors.textOnDark} />
          <Text style={styles.socialText}>Continuer avec Google</Text>
        </Pressable>
        {note && <Text style={styles.note}>{note}</Text>}

        <View style={styles.orRow}>
          <View style={styles.line} />
          <Text style={styles.or}>OU</Text>
          <View style={styles.line} />
        </View>

        <TextField
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+221 77 000 00 00"
          keyboardType="phone-pad"
          autoCapitalize="none"
        />
        <View>
          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
          />
          <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityLabel="Afficher le mot de passe">
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textOnDarkMuted} />
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Me connecter" onPress={onSubmit} loading={loading} style={styles.cta} />

        <Link href="/(auth)/signup" style={styles.link}>
          <Text style={styles.linkText}>Pas encore de compte — s'inscrire</Text>
        </Link>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', height: 40 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  headerSpacer: { width: 26 },
  body: { paddingTop: spacing.xxl },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inkLine,
  },
  socialText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 16 },
  note: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.inkLine },
  or: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 13 },
  eye: { position: 'absolute', right: spacing.lg, top: 38 },
  error: { color: colors.accent, marginBottom: spacing.md, marginTop: spacing.sm, fontFamily: fonts.bodyBold },
  cta: { borderRadius: radius.pill, marginTop: spacing.lg },
  link: { marginTop: spacing.xl, alignSelf: 'center' },
  linkText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold },
});
