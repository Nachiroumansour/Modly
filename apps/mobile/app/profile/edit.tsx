import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { useUpdateProfile, useUploadProfilePhotos, type ProfileInput } from '../../src/profile/hooks';
import { validateProfile } from '../../src/profile/validateProfile';
import { useTailorProfile } from '../../src/tailors/hooks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/TextField';

/** Parse un champ numérique optionnel : '' → undefined, sinon entier (NaN → undefined). */
function toNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const n = Number.parseInt(trimmed, 10);
  return Number.isNaN(n) ? undefined : n;
}

export default function ProfileEdit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tailor } = useTailorProfile(user?.id ?? '');
  const { save, saving } = useUpdateProfile();
  const { upload, uploading } = useUploadProfilePhotos();

  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyDraft, setSpecialtyDraft] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Pré-remplir depuis le profil chargé (une seule fois).
  useEffect(() => {
    if (ready || !tailor) return;
    const p = tailor.profile;
    if (p) {
      setBio(p.bio ?? '');
      setLocation(p.location ?? '');
      setSpecialties(p.specialties ?? []);
      setYearsExperience(p.yearsExperience != null ? String(p.yearsExperience) : '');
      setPriceMin(p.priceMin != null ? String(p.priceMin) : '');
      setPriceMax(p.priceMax != null ? String(p.priceMax) : '');
    }
    setReady(true);
  }, [tailor, ready]);

  if (user && user.role !== 'TAILLEUR') {
    router.replace('/(tabs)/profile');
    return null;
  }

  async function pick(aspect: [number, number], onPicked: (uri: string) => void) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Autorise l’accès aux photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.9,
    });
    if (!res.canceled && res.assets[0]) onPicked(res.assets[0].uri);
  }

  function addSpecialty() {
    const s = specialtyDraft.trim();
    if (s && !specialties.includes(s) && specialties.length < 10) {
      setSpecialties((prev) => [...prev, s]);
    }
    setSpecialtyDraft('');
  }

  async function submit() {
    setError(null);
    const input: ProfileInput = {
      bio: bio.trim() || undefined,
      location: location.trim() || undefined,
      specialties,
      yearsExperience: toNumber(yearsExperience),
      priceMin: toNumber(priceMin),
      priceMax: toNumber(priceMax),
    };
    const err = validateProfile(input);
    if (err) {
      setError(err);
      return;
    }
    try {
      if (avatarUri || coverUri) {
        await upload({ avatarUri: avatarUri ?? undefined, coverUri: coverUri ?? undefined });
      }
      await save(input);
      router.back();
    } catch {
      setError('L’enregistrement a échoué. Réessaie.');
    }
  }

  const coverPreview = coverUri ?? tailor?.profile?.coverUrl ?? null;
  const avatarPreview = avatarUri ?? tailor?.avatarUrl ?? null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Modifier le profil</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Couverture */}
        <Pressable style={styles.coverPicker} onPress={() => pick([16, 9], setCoverUri)}>
          {coverPreview ? (
            <Image source={{ uri: coverPreview }} style={styles.coverImg} contentFit="cover" />
          ) : (
            <View style={styles.coverEmpty}>
              <Feather name="image" size={24} color={colors.accent} />
              <Text style={styles.pickText}>Ajouter une couverture</Text>
            </View>
          )}
        </Pressable>

        {/* Avatar */}
        <Pressable style={styles.avatarPicker} onPress={() => pick([1, 1], setAvatarUri)}>
          {avatarPreview ? (
            <Image source={{ uri: avatarPreview }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <View style={[styles.avatarImg, styles.avatarEmpty]}>
              <Feather name="camera" size={22} color={colors.accent} />
            </View>
          )}
          <Text style={styles.pickText}>Changer la photo</Text>
        </Pressable>

        <View style={styles.form}>
          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Présente ton atelier, ton style…"
            multiline
            style={styles.multiline}
          />
          <TextField
            label="Localisation"
            value={location}
            onChangeText={setLocation}
            placeholder="Dakar, Sénégal"
          />

          <Text style={styles.label}>Spécialités</Text>
          <View style={styles.specRow}>
            <TextInput
              value={specialtyDraft}
              onChangeText={setSpecialtyDraft}
              onSubmitEditing={addSpecialty}
              placeholder="Mariage, Bazin…"
              placeholderTextColor={colors.textOnDarkMuted}
              style={styles.specInput}
              returnKeyType="done"
            />
            <Pressable style={styles.addBtn} onPress={addSpecialty} testID="add-specialty">
              <Feather name="plus" size={18} color={colors.textOnDark} />
            </Pressable>
          </View>
          {specialties.length > 0 ? (
            <View style={styles.chips}>
              {specialties.map((s) => (
                <Pressable
                  key={s}
                  style={styles.chip}
                  onPress={() => setSpecialties((prev) => prev.filter((x) => x !== s))}
                >
                  <Text style={styles.chipText}>{s}</Text>
                  <Feather name="x" size={12} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <TextField
            label="Années d'expérience"
            value={yearsExperience}
            onChangeText={setYearsExperience}
            placeholder="8"
            keyboardType="number-pad"
          />
          <View style={styles.priceRow}>
            <View style={styles.priceCol}>
              <TextField
                label="Prix min (FCFA)"
                value={priceMin}
                onChangeText={setPriceMin}
                placeholder="15000"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.priceCol}>
              <TextField
                label="Prix max (FCFA)"
                value={priceMax}
                onChangeText={setPriceMax}
                placeholder="60000"
                keyboardType="number-pad"
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Enregistrer" onPress={submit} loading={saving || uploading} />
      </View>
    </View>
  );
}

const AVATAR = 88;

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
  coverPicker: {
    marginHorizontal: spacing.lg,
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.inkElevated,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.inkLine,
  },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  avatarPicker: { alignItems: 'center', marginTop: -AVATAR / 2, gap: spacing.xs },
  avatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.inkElevated,
  },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  pickText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 },
  form: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  multiline: { height: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  label: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  specRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  specInput: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    color: colors.textOnDark,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  chipText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 12 },
  priceRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  priceCol: { flex: 1 },
  error: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
    textAlign: 'center',
    marginTop: spacing.md,
  },
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
