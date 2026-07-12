import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateClientRecord } from '../../src/clients/hooks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { Button } from '../../src/ui/Button';

export default function CreateClient() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createRecord, creating } = useCreateClientRecord();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stylePref, setStylePref] = useState('');
  const [tissuPref, setTissuPref] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (name.trim().length === 0) return setError('Le nom du client est requis.');
    try {
      const { record } = await createRecord({
        name: name.trim(),
        phone: phone.trim() || undefined,
        stylePref: stylePref.trim() || undefined,
        tissuPref: tissuPref.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      router.replace(`/client/${record.id}`);
    } catch {
      setError("La fiche n'a pas pu être créée. Réessaie.");
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Nouveau client</Text>
          <View style={{ width: 26 }} />
        </View>

        <Field label="Nom du client" value={name} onChangeText={setName} placeholder="Awa Ndiaye" />
        <Field label="Téléphone" value={phone} onChangeText={setPhone} placeholder="+221 77 000 00 00" keyboardType="phone-pad" />
        <Field label="Style préféré" value={stylePref} onChangeText={setStylePref} placeholder="Boubou, moderne…" />
        <Field label="Tissu préféré" value={tissuPref} onChangeText={setTissuPref} placeholder="Bazin, wax…" />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Préférences, remarques…" multiline />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Créer la fiche" onPress={submit} loading={creating} />
      </View>
    </View>
  );
}

function Field({
  label,
  multiline,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textOnDarkMuted}
        style={[styles.input, multiline && styles.inputMulti]}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  field: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  label: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  inputMulti: { height: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  error: { color: colors.accent, fontFamily: fonts.bodyBold, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.inkLine,
  },
});
