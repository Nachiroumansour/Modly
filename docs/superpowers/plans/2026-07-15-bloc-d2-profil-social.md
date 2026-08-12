# Bloc D2 — Profil social — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le profil social — un composant `ProfileHero` partagé (avatar, nom, vérifié, localisation/rôle, stats, bio, spécialités) réutilisé par le profil public du tailleur ET l'onglet Profil (qui devient la vitrine du tailleur / l'identité du client).

**Architecture:** Extraire `ProfileHero` (présentiel, testable) depuis le profil public existant, puis l'utiliser dans les deux écrans profil. L'onglet Profil du tailleur récupère sa propre fiche via `useTailorProfile(user.id)` (endpoint existant → aucun backend). Aucun changement API.

**Tech Stack:** Expo SDK 54, React Native, TypeScript strict ; jest-expo + RNTL.

## Global Constraints

- **Aucun changement backend.** Réutiliser `useTailorProfile` (pas de nouveau hook réseau).
- Tokens de thème only (`src/theme.ts`) ; jamais de `fontWeight`.
- Français simple dans l'UI.
- **Piège babel** : pas d'apostrophe courbe U+2019 (’) dans les strings des fichiers **.ts** (casse le tokenizer babel-preset-expo) ; ASCII en `.ts`, `.tsx` tolère U+2019.
- Ne pas casser les suites (99 API / **48 mobile**). Zéro régression visuelle sur le profil public.
- Commandes mobile depuis `apps/mobile` : `npx jest`, `npx tsc --noEmit`.

---

### Task 1: `ProfileHero` — bloc d'identité partagé

**Files:**
- Create: `apps/mobile/src/profile/ProfileHero.tsx`
- Create: `apps/mobile/src/profile/ProfileHero.test.tsx`

**Interfaces:**
- Produces: `ProfileHero({ name, roleLabel?, location?, verified?, stats?, bio?, specialties? })` où `stats?: { label: string; value: number }[]`. Affiche avatar (initiale de `name`), nom (+ badge vérifié), chip rôle OU localisation, rangée de stats, bio, chips spécialités — chaque section conditionnée à sa donnée.

- [ ] **Step 1: Écrire le test qui échoue**

```tsx
// apps/mobile/src/profile/ProfileHero.test.tsx
import { render, screen } from '@testing-library/react-native';
import { ProfileHero } from './ProfileHero';

describe('ProfileHero', () => {
  it('affiche le nom', () => {
    render(<ProfileHero name="Atelier Awa" />);
    expect(screen.getByText('Atelier Awa')).toBeTruthy();
  });

  it('affiche les stats fournies', () => {
    render(
      <ProfileHero
        name="Atelier Awa"
        stats={[{ label: 'Modeles', value: 8 }, { label: 'Abonnes', value: 25 }]}
      />,
    );
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Modeles')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('Abonnes')).toBeTruthy();
  });

  it('affiche bio et specialites quand fournies', () => {
    render(<ProfileHero name="Awa" bio="Bazin et broderie" specialties={['Mariage', 'Boubou']} />);
    expect(screen.getByText('Bazin et broderie')).toBeTruthy();
    expect(screen.getByText('Mariage')).toBeTruthy();
    expect(screen.getByText('Boubou')).toBeTruthy();
  });

  it('affiche le chip role quand fourni', () => {
    render(<ProfileHero name="Fatou" roleLabel="Client" />);
    expect(screen.getByText('Client')).toBeTruthy();
  });

  it('naffiche pas de stats quand non fournies', () => {
    render(<ProfileHero name="Awa" />);
    expect(screen.queryByText('Modeles')).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/mobile && npx jest src/profile/ProfileHero.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `ProfileHero`**

```tsx
// apps/mobile/src/profile/ProfileHero.tsx
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

type Stat = { label: string; value: number };
type Props = {
  name: string;
  roleLabel?: string;
  location?: string | null;
  verified?: boolean;
  stats?: Stat[];
  bio?: string | null;
  specialties?: string[];
};

export function ProfileHero({ name, roleLabel, location, verified, stats, bio, specialties }: Props) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <View style={styles.hero}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.name}>{name}</Text>
        {verified ? <Feather name="check-circle" size={18} color={colors.accent} /> : null}
      </View>

      {roleLabel ? (
        <View style={styles.roleChip}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      ) : null}

      {location ? (
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={13} color={colors.textOnDarkMuted} />
          <Text style={styles.location}>{location}</Text>
        </View>
      ) : null}

      {stats && stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map((s, i) => (
            <View key={s.label} style={styles.statWrap}>
              {i > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.stat}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {bio ? <Text style={styles.bio}>{bio}</Text> : null}

      {specialties && specialties.length > 0 ? (
        <View style={styles.specialties}>
          {specialties.map((s) => (
            <View key={s} style={styles.specChip}>
              <Text style={styles.specText}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 38 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.textOnDark, fontFamily: fonts.display, fontSize: 26 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.accentSoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  roleText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  location: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 14 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  statWrap: { flexDirection: 'row', alignItems: 'center' },
  stat: { alignItems: 'center', paddingHorizontal: spacing.xl },
  statValue: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 22 },
  statLabel: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.inkLine },
  bio: {
    color: colors.textOnDark,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  specialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  specChip: {
    backgroundColor: colors.accentSoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  specText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 12 },
});
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd apps/mobile && npx jest src/profile/ProfileHero.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/profile/ProfileHero.tsx apps/mobile/src/profile/ProfileHero.test.tsx
git commit -m "feat(mobile): composant ProfileHero (bloc identité partagé)"
```

---

### Task 2: Profil public tailleur — utiliser `ProfileHero`

**Files:**
- Modify: `apps/mobile/app/tailor/[id].tsx`

**Interfaces:**
- Consumes: `ProfileHero` (Task 1).

- [ ] **Step 1: Remplacer le bloc hero maison par `ProfileHero`**

Dans `apps/mobile/app/tailor/[id].tsx` :

1. Importer : `import { ProfileHero } from '../../src/profile/ProfileHero';`
2. Remplacer tout le bloc `<View style={styles.hero}> ... </View>` **et** les blocs
   séparés `{tailor.profile?.bio ? ...}` et `{tailor.profile && ...specialties...}`
   par : le `ProfileHero` (identité + stats + bio + spécialités) suivi du **bouton
   Suivre** conservé. Concrètement, remplacer depuis `<View style={styles.hero}>`
   jusqu'à la fin du bloc spécialités par :

```tsx
        <ProfileHero
          name={tailor.name}
          verified={tailor.profile?.verified}
          location={tailor.profile?.location}
          stats={[
            { label: 'Modeles', value: tailor.designsCount },
            { label: 'Abonnes', value: tailor.followersCount },
          ]}
          bio={tailor.profile?.bio}
          specialties={tailor.profile?.specialties ?? []}
        />

        {canFollow ? (
          <Pressable
            style={[styles.follow, followedByMe && styles.followActive]}
            onPress={() => toggleFollow(followedByMe)}
            disabled={following}
          >
            <Text style={[styles.followText, followedByMe && styles.followTextActive]}>
              {followedByMe ? 'Abonne' : 'Suivre'}
            </Text>
          </Pressable>
        ) : null}
```

3. Nettoyer les styles désormais inutilisés dans ce fichier (`hero`, `avatar`,
   `avatarText`, `nameRow`, `name`, `locationRow`, `location`, `stats`, `stat`,
   `statValue`, `statLabel`, `statDivider`, `bio`, `specialties`, `specChip`,
   `specText`) — les supprimer du `StyleSheet` pour éviter les avertissements
   `noUnusedLocals` (garder `follow`, `followActive`, `followText`, `followTextActive`,
   `root`, `center`, `topbar`, `sectionTitle`, `empty`). Le bouton Suivre doit être
   centré : ajouter `alignSelf: 'center'` au style `follow` si nécessaire.

- [ ] **Step 2: Typecheck + suite (non-régression)**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean (aucun style inutilisé) ; toute la suite verte (48).

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/tailor/[id].tsx"
git commit -m "refactor(mobile): profil public tailleur via ProfileHero"
```

---

### Task 3: Onglet Profil social (tailleur = vitrine, client = identité)

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `ProfileHero` (Task 1), `useTailorProfile` (`../../src/tailors/hooks`), `TailorProfileBody` (existant).

- [ ] **Step 1: Réécrire le corps connecté du profil**

Dans `apps/mobile/app/(tabs)/profile.tsx` :

1. Imports : remplacer `import { usePortfolio } from '../../src/designs/hooks';` par
   `import { useTailorProfile } from '../../src/tailors/hooks';` et ajouter
   `import { ProfileHero } from '../../src/profile/ProfileHero';`.
2. Données : remplacer
   `const { designs } = usePortfolio(user?.role === 'TAILLEUR' ? user.id : undefined);`
   par
   `const { tailor, designs } = useTailorProfile(user?.role === 'TAILLEUR' ? (user.id as string) : '');`
   (le hook a `enabled: Boolean(id)` → chaîne vide = désactivé pour le client, pas de requête).
3. Remplacer le bloc en-tête maison — de `<View style={styles.header}> ... </View>` — par :

```tsx
        {user.role === 'TAILLEUR' ? (
          <ProfileHero
            name={user.name}
            verified={tailor?.profile?.verified}
            location={tailor?.profile?.location}
            stats={[
              { label: 'Modeles', value: tailor?.designsCount ?? 0 },
              { label: 'Abonnes', value: tailor?.followersCount ?? 0 },
            ]}
            bio={tailor?.profile?.bio}
            specialties={tailor?.profile?.specialties ?? []}
          />
        ) : (
          <ProfileHero name={user.name} roleLabel="Client" />
        )}
```

4. La liste des réglages reste, mais retirer la ligne « Modifier le profil » du haut
   si tu veux (optionnel) — **garder** au minimum : pour le client la ligne
   « Mes mesures » ; pour tous « Notifications » / « Aide » (Bientôt) ; puis le
   `TailorProfileBody` (tailleur) et `Se déconnecter` — inchangés. Le bloc devient :

```tsx
        <View style={styles.list}>
          {user.role === 'CLIENT' ? (
            <Row icon="sliders" label="Mes mesures" onPress={() => router.push('/my-measurements')} />
          ) : null}
          <Row icon="bell" label="Notifications" soon />
          <Row icon="help-circle" label="Aide" soon />
        </View>

        {user.role === 'TAILLEUR' ? (
          <TailorProfileBody
            designs={designs}
            onPublish={() => router.push('/publish')}
            onOpenClients={() => router.push('/clients')}
            onOpenDesign={(id) => router.push(`/design/${id}`)}
          />
        ) : null}

        <Pressable style={styles.logout} onPress={logout}>
          <Feather name="log-out" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Se deconnecter</Text>
        </Pressable>
```

5. Supprimer du `StyleSheet` les styles de l'ancien en-tête devenus inutilisés
   (`header`, `avatar`, `avatarText`, `name`, `roleChip`, `roleText`) pour éviter
   `noUnusedLocals`. Garder tout le reste (`list`, `row`, `logout`, `guest…`, etc.).

- [ ] **Step 2: Typecheck + suite complète**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean ; toute la suite verte.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(tabs)/profile.tsx"
git commit -m "feat(mobile): onglet Profil social (tailleur = vitrine, client = identité)"
```

---

### Task 4: Vérification finale

**Files:** aucun (validation).

- [ ] **Step 1: Suite + typecheck**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean ; mobile verte (48 + 5 ProfileHero).

- [ ] **Step 2: Bundle de production**

Run: `cd apps/mobile && npx expo export --platform ios --output-dir /tmp/moodly-export-d2`
Expected: export réussi. Puis `rm -rf /tmp/moodly-export-d2`.

- [ ] **Step 3: Revue manuelle (Expo Go)**

`npx expo start --host lan -c` + API `npm run dev`. Vérifier :
- **Onglet Profil, tailleur** (`+221770009999`/`secret123`) : grand hero avec
  **stats Modèles/Abonnés**, bio + spécialités (si renseignées), puis « Mes fiches
  clients » + grille de ses modèles + Publier ; Se déconnecter en bas.
- **Onglet Profil, client** : hero avec chip « Client » + « Mes mesures ».
- **Profil public** d'un tailleur (depuis la ligne auteur d'un modèle) : rendu
  **identique** à avant (hero mutualisé) + bouton Suivre fonctionnel.

---

## Notes d'implémentation

- **Réutilisation de l'endpoint** : `useTailorProfile(user.id)` frappe `GET /tailors/:id`
  comme le profil public ; pour le tailleur connecté, `followedByMe` est faux et n'est
  pas utilisé ici. Aucun backend ajouté.
- **Client** : `useTailorProfile('')` est désactivé (`enabled: Boolean('')` = false) →
  `tailor` reste `null`, aucune requête ; le `ProfileHero` client n'utilise que `name`.
- **Zéro régression visuelle** attendue sur le profil public : `ProfileHero` reprend
  les mêmes tokens/tailles que le hero d'origine ; seuls le lieu du code change.
- Réglages/édition du profil et upload d'avatar restent hors périmètre (cycles ultérieurs).
