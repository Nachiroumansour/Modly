import type { DesignCategory, Role } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_LABELS, DESIGN_CATEGORIES } from '../designs/categories';
import { ApiClientError } from '../lib/api';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuth } from './AuthContext';

const STEPS = ['phone', 'password', 'name', 'role', 'interests'] as const;
type Step = (typeof STEPS)[number];
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const MIN_INTERESTS = 3;

export default function SignupWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [interests, setInterests] = useState<DesignCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const current: Step = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const canAdvance =
    (current === 'phone' && PHONE_RE.test(phone.trim())) ||
    (current === 'password' && password.length >= 6) ||
    (current === 'name' && name.trim().length > 0) ||
    (current === 'role' && role !== null) ||
    (current === 'interests' && interests.length >= MIN_INTERESTS);

  function back() {
    setError(null);
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  function toggleInterest(c: DesignCategory) {
    setInterests((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));
  }

  async function next() {
    if (!canAdvance) return;
    setError(null);
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    setLoading(true);
    try {
      await register({ phone: phone.trim(), password, name: name.trim(), role: role!, interests });
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Inscription impossible. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityLabel="Retour">
          <Feather name="chevron-left" size={28} color={colors.textOnDark} />
        </Pressable>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {current === 'phone' && (
          <>
            <Text style={styles.title}>Quel est ton numéro ?</Text>
            <TextField
              label="Téléphone"
              value={phone}
              onChangeText={setPhone}
              placeholder="+221 77 000 00 00"
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoFocus
            />
          </>
        )}

        {current === 'password' && (
          <>
            <Text style={styles.title}>Crée un mot de passe</Text>
            <View>
              <TextField
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholder="Crée un mot de passe fort"
                secureTextEntry={!showPassword}
                autoFocus
              />
              <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityLabel="Afficher le mot de passe">
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textOnDarkMuted} />
              </Pressable>
            </View>
            <Text style={styles.hint}>Utilise au moins 6 caractères.</Text>
          </>
        )}

        {current === 'name' && (
          <>
            <Text style={styles.title}>Comment tu t'appelles ?</Text>
            <TextField label="Prénom" value={name} onChangeText={setName} placeholder="Awa" autoFocus />
          </>
        )}

        {current === 'role' && (
          <>
            <Text style={styles.title}>Tu es…</Text>
            <View style={styles.roleRow}>
              <RoleCard label="Client" hint="Je cherche des modèles" active={role === 'CLIENT'} onPress={() => setRole('CLIENT')} />
              <RoleCard label="Tailleur" hint="Je crée des modèles" active={role === 'TAILLEUR'} onPress={() => setRole('TAILLEUR')} />
            </View>
          </>
        )}

        {current === 'interests' && (
          <>
            <Text style={styles.title}>Qu'est-ce qui t'inspire ?</Text>
            <Text style={styles.hint}>Choisis-en {MIN_INTERESTS} ou plus pour personnaliser ton feed.</Text>
            <View style={styles.chips}>
              {DESIGN_CATEGORIES.map((c) => {
                const on = interests.includes(c);
                return (
                  <Pressable key={c} onPress={() => toggleInterest(c)} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{CATEGORY_LABELS[c]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label={isLast ? 'Créer mon compte' : 'Suivant'}
          onPress={next}
          disabled={!canAdvance}
          loading={loading}
          style={styles.cta}
        />
      </View>
    </View>
  );
}

function RoleCard({ label, hint, active, onPress }: { label: string; hint: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.roleCard, active && styles.roleCardActive]}>
      <Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
      <Text style={[styles.roleHint, active && styles.roleHintActive]}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', height: 40 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkLine },
  dotActive: { width: 20, backgroundColor: colors.textOnDark },
  headerSpacer: { width: 28 },
  body: { paddingTop: spacing.xxl, flexGrow: 1 },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 30, marginBottom: spacing.xl, lineHeight: 36 },
  hint: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13, marginTop: -spacing.sm, marginBottom: spacing.lg },
  eye: { position: 'absolute', right: spacing.lg, top: 38 },
  roleRow: { flexDirection: 'row', gap: spacing.md },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inkLine,
    backgroundColor: colors.inkElevated,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
  chipTextOn: { color: colors.accent },
  error: { color: colors.accent, marginTop: spacing.lg, fontFamily: fonts.bodyBold },
  footer: { paddingTop: spacing.md },
  cta: { borderRadius: radius.pill },
});
