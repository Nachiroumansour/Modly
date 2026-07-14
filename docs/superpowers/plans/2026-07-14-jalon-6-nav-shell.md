# Jalon 6 (A+B) — Réalignement nav + app shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner la forme visible de l'app mobile sur le flow de référence — même barre à 5 onglets pour client et tailleur avec un onglet central mis en avant (⊕ Publier / 🔖 Sauvegardés), plus un header permanent (logo + notifications + accès fiches clients tailleur) sur un feed unifié en sombre.

**Architecture:** La logique « quels onglets pour quel rôle » est extraite dans un helper pur et testable (`src/navigation/tabs.ts`) que `app/(tabs)/_layout.tsx` consomme. Le bouton central surélevé est un composant présentiel (`CenterTabButton`). Le header permanent est un composant partagé (`AppHeader`) rendu en haut de chaque écran d'onglet. Aucun changement backend.

**Tech Stack:** Expo SDK 54, expo-router 6 (Tabs), React Native 0.81, TypeScript strict, `@expo/vector-icons` (Feather), jest-expo + @testing-library/react-native.

## Global Constraints

- **Aucun changement backend** — API et Prisma inchangés dans ce jalon.
- **Mode sombre** — palette sombre par défaut (conforme à la référence « mode sombre activé par défaut »). Pas de bascule clair/sombre.
- **Tokens de thème uniquement** — couleurs/polices/espacements via `src/theme.ts` (`colors`, `fonts`, `spacing`, `radius`). Jamais de valeurs en dur.
- **Polices** — titres `fonts.display`/`fonts.displayBold` (Fraunces), UI `fonts.body`/`fonts.bodyBold` (Manrope). Ne jamais mettre de `fontWeight` (conflit avec `fontFamily`).
- **Route du flux de publication** — `/publish` (fichier `app/publish.tsx`, déjà existant). L'onglet central tailleur utilise un nom de route distinct `create` pour éviter la collision de chemin.
- **Hors périmètre (bloc C)** — carrousel détail, Commander/Mesures enrichis, sections Recherche, Sauvegardés 2 sections, écran Paramètres complet. Ne pas les implémenter.
- **Marque** — le logo du header affiche « Modly » (orthographe de la référence et du repo).

---

### Task 1: Helper de navigation role-aware (`src/navigation/tabs.ts`)

Logique pure : quels onglets sont visibles selon le rôle, et lequel est l'onglet central.

**Files:**
- Create: `apps/mobile/src/navigation/tabs.ts`
- Test: `apps/mobile/src/navigation/tabs.test.ts`

**Interfaces:**
- Consumes: `Role` depuis `@moodly/shared`.
- Produces:
  - `type TabName = 'feed' | 'search' | 'create' | 'saved' | 'orders' | 'profile'`
  - `visibleTabs(role: Role | null): TabName[]`
  - `centerTab(role: Role | null): 'create' | 'saved' | null`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/navigation/tabs.test.ts
import { visibleTabs, centerTab } from './tabs';

describe('navigation tabs', () => {
  it('tailleur : Accueil · Rechercher · Publier(create) · Commandes · Profil', () => {
    expect(visibleTabs('TAILLEUR')).toEqual(['feed', 'search', 'create', 'orders', 'profile']);
  });

  it('client : Accueil · Rechercher · Sauvegardés · Commandes · Profil', () => {
    expect(visibleTabs('CLIENT')).toEqual(['feed', 'search', 'saved', 'orders', 'profile']);
  });

  it('sans compte : Accueil · Rechercher · Profil', () => {
    expect(visibleTabs(null)).toEqual(['feed', 'search', 'profile']);
  });

  it('onglet central : create pour tailleur, saved pour client, null sinon', () => {
    expect(centerTab('TAILLEUR')).toBe('create');
    expect(centerTab('CLIENT')).toBe('saved');
    expect(centerTab(null)).toBeNull();
  });

  it('le centre est toujours en 3e position (index 2) pour un rôle authentifié', () => {
    expect(visibleTabs('TAILLEUR')[2]).toBe(centerTab('TAILLEUR'));
    expect(visibleTabs('CLIENT')[2]).toBe(centerTab('CLIENT'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest src/navigation/tabs.test.ts`
Expected: FAIL — `Cannot find module './tabs'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/mobile/src/navigation/tabs.ts
import type { Role } from '@moodly/shared';

export type TabName = 'feed' | 'search' | 'create' | 'saved' | 'orders' | 'profile';

/** Onglets visibles selon le rôle. Le 3e (index 2) est toujours l'onglet central. */
export function visibleTabs(role: Role | null): TabName[] {
  if (role === 'TAILLEUR') return ['feed', 'search', 'create', 'orders', 'profile'];
  if (role === 'CLIENT') return ['feed', 'search', 'saved', 'orders', 'profile'];
  return ['feed', 'search', 'profile'];
}

/** Onglet central mis en avant : Publier (tailleur) ou Sauvegardés (client). */
export function centerTab(role: Role | null): 'create' | 'saved' | null {
  if (role === 'TAILLEUR') return 'create';
  if (role === 'CLIENT') return 'saved';
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest src/navigation/tabs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/navigation/tabs.ts apps/mobile/src/navigation/tabs.test.ts
git commit -m "feat(mobile): helper nav role-aware (visibleTabs/centerTab)"
```

---

### Task 2: Bouton central surélevé (`src/navigation/CenterTabButton.tsx`)

Le bouton rond accent en relief pour l'onglet central (façon Instagram).

**Files:**
- Create: `apps/mobile/src/navigation/CenterTabButton.tsx`
- Test: `apps/mobile/src/navigation/CenterTabButton.test.tsx`

**Interfaces:**
- Consumes: `colors`, `fonts` depuis `../theme` ; `Feather`.
- Produces: `CenterTabButton({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress?: (e: GestureResponderEvent) => void })`. Conçu pour être passé à l'option `tabBarButton` d'un `Tabs.Screen` (reçoit `onPress` de react-navigation).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/navigation/CenterTabButton.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CenterTabButton } from './CenterTabButton';

describe('CenterTabButton', () => {
  it('affiche le label et déclenche onPress', () => {
    const onPress = jest.fn();
    render(<CenterTabButton icon="plus" label="Publier" onPress={onPress} />);
    expect(screen.getByText('Publier')).toBeTruthy();
    fireEvent.press(screen.getByText('Publier'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest src/navigation/CenterTabButton.test.tsx`
Expected: FAIL — `Cannot find module './CenterTabButton'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/mobile/src/navigation/CenterTabButton.tsx
import { Feather } from '@expo/vector-icons';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
};

/** Onglet central en relief (façon Insta) : pastille ronde accent + label dessous. */
export function CenterTabButton({ icon, label, onPress }: Props) {
  return (
    <Pressable style={styles.wrap} onPress={onPress} accessibilityRole="button">
      <View style={styles.circle}>
        <Feather name={icon} size={24} color={colors.textOnDark} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 11, marginTop: 4 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest src/navigation/CenterTabButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/navigation/CenterTabButton.tsx apps/mobile/src/navigation/CenterTabButton.test.tsx
git commit -m "feat(mobile): bouton d'onglet central surélevé"
```

---

### Task 3: Header permanent (`src/ui/AppHeader.tsx`)

Barre du haut identique sur tous les écrans d'onglet : logo à gauche ; à droite cloche notifications, et icône fiches clients pour le tailleur uniquement.

**Files:**
- Create: `apps/mobile/src/ui/AppHeader.tsx`
- Test: `apps/mobile/src/ui/AppHeader.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`../auth/AuthContext`), `useRouter` (`expo-router`), `useSafeAreaInsets`, tokens de thème.
- Produces: `AppHeader()` — aucun prop. testIDs : `header-notifications` (toujours), `header-clients` (tailleur seulement).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/ui/AppHeader.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppHeader } from './AppHeader';
import { useAuth } from '../auth/AuthContext';

const push = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../auth/AuthContext');
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function authState(over: Partial<ReturnType<typeof useAuth>>) {
  return { user: null, token: null, loading: false, login: jest.fn(), logout: jest.fn(), refresh: jest.fn(), ...over } as ReturnType<typeof useAuth>;
}

describe('AppHeader', () => {
  beforeEach(() => push.mockClear());

  it('affiche le logo Modly et la cloche notifications', () => {
    mockedUseAuth.mockReturnValue(authState({ user: { id: 'c', name: 'Awa', role: 'CLIENT', phone: '', avatarUrl: null } as any }));
    render(<AppHeader />);
    expect(screen.getByText('Modly')).toBeTruthy();
    expect(screen.getByTestId('header-notifications')).toBeTruthy();
  });

  it("n'affiche PAS l'icône fiches clients pour un client", () => {
    mockedUseAuth.mockReturnValue(authState({ user: { id: 'c', name: 'Awa', role: 'CLIENT', phone: '', avatarUrl: null } as any }));
    render(<AppHeader />);
    expect(screen.queryByTestId('header-clients')).toBeNull();
  });

  it("affiche l'icône fiches clients pour un tailleur et ouvre /clients", () => {
    mockedUseAuth.mockReturnValue(authState({ user: { id: 't', name: 'Modou', role: 'TAILLEUR', phone: '', avatarUrl: null } as any }));
    render(<AppHeader />);
    fireEvent.press(screen.getByTestId('header-clients'));
    expect(push).toHaveBeenCalledWith('/clients');
  });

  it('la cloche ouvre /notifications', () => {
    mockedUseAuth.mockReturnValue(authState({ user: null }));
    render(<AppHeader />);
    fireEvent.press(screen.getByTestId('header-notifications'));
    expect(push).toHaveBeenCalledWith('/notifications');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest src/ui/AppHeader.test.tsx`
Expected: FAIL — `Cannot find module './AppHeader'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/mobile/src/ui/AppHeader.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, fonts, spacing } from '../theme';

/** Header permanent affiché en haut de chaque écran d'onglet. */
export function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isTailor = user?.role === 'TAILLEUR';

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.logo}>Modly</Text>
      <View style={styles.actions}>
        {isTailor ? (
          <Pressable testID="header-clients" hitSlop={10} onPress={() => router.push('/clients')}>
            <Feather name="users" size={22} color={colors.textOnDark} />
          </Pressable>
        ) : null}
        <Pressable testID="header-notifications" hitSlop={10} onPress={() => router.push('/notifications')}>
          <Feather name="bell" size={22} color={colors.textOnDark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.ink,
  },
  logo: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 24 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest src/ui/AppHeader.test.tsx`
Expected: PASS (4 tests). If the `useAuth` return shape in the mock helper doesn't match the real context, align `authState` keys with the actual `AuthContextValue` (open `src/auth/AuthContext.tsx` and copy its value keys).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ui/AppHeader.tsx apps/mobile/src/ui/AppHeader.test.tsx
git commit -m "feat(mobile): header permanent (logo + notifications + fiches clients tailleur)"
```

---

### Task 4: Écran notifications placeholder (`app/notifications.tsx`)

Destination de la cloche. Écran statique (les notifications réelles sont dans le bloc C / futur).

**Files:**
- Create: `apps/mobile/app/notifications.tsx`

**Interfaces:**
- Consumes: `useRouter`, `useSafeAreaInsets`, tokens de thème. Route publique `/notifications`.
- Produces: écran par défaut (pas d'export nommé consommé ailleurs).

- [ ] **Step 1: Create the screen**

```tsx
// apps/mobile/app/notifications.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../src/theme';

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.textOnDark} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={styles.empty}>
        <View style={styles.badge}>
          <Feather name="bell" size={26} color={colors.accent} />
        </View>
        <Text style={styles.emptyText}>Bientôt tes notifications ici.</Text>
      </View>
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
    paddingBottom: spacing.md,
  },
  title: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.inkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
});
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/notifications.tsx
git commit -m "feat(mobile): écran notifications (placeholder)"
```

---

### Task 5: Réécrire la barre d'onglets (`app/(tabs)/_layout.tsx` + `app/(tabs)/create.tsx`)

Barre role-aware via le helper, onglet central surélevé, `create` (tailleur) qui ouvre `/publish`, `portfolio`/`clients` retirés de la barre.

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx` (réécriture complète du composant `TabsLayout`)
- Create: `apps/mobile/app/(tabs)/create.tsx` (écran de l'onglet central tailleur — redirige vers le flux `/publish`)

**Interfaces:**
- Consumes: `visibleTabs`, `centerTab` (Task 1) ; `CenterTabButton` (Task 2) ; `useAuth`.
- Produces: barre d'onglets finale. Routes `create`, `saved`, `orders`, `search`, `portfolio`, `clients`, `feed`, `profile` déclarées ; visibilité pilotée par `href`.

- [ ] **Step 1: Create the center-tab redirect screen**

```tsx
// apps/mobile/app/(tabs)/create.tsx
import { Redirect } from 'expo-router';

// L'onglet central "Publier" ouvre le flux /publish (via tabBarButton dans _layout).
// Ce composant n'est normalement jamais affiché ; en cas d'accès direct, on redirige.
export default function CreateTab() {
  return <Redirect href="/publish" />;
}
```

- [ ] **Step 2: Rewrite `_layout.tsx`**

```tsx
// apps/mobile/app/(tabs)/_layout.tsx
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { CenterTabButton } from '../../src/navigation/CenterTabButton';
import { centerTab, visibleTabs, type TabName } from '../../src/navigation/tabs';
import { colors, fonts } from '../../src/theme';

type FeatherName = keyof typeof Feather.glyphMap;

function icon(name: FeatherName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size - 1} color={color} />
  );
}

// Fond en verre dépoli (façon WhatsApp/iOS) — blur + voile sombre pour le contraste.
function GlassTabBar() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView tint="dark" intensity={36} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={styles.veil} />
      <View style={styles.hairline} />
    </View>
  );
}

/**
 * Barre d'onglets alignée sur le flow de référence :
 * - Sans compte : Accueil · Recherche · Profil
 * - Client      : Accueil · Recherche · [Sauvegardés] · Commandes · Profil
 * - Tailleur    : Accueil · Recherche · [⊕ Publier] · Commandes · Profil
 * L'onglet central (index 2) est surélevé. Portfolio et Clients ne sont plus des
 * onglets (href: null) ; ils restent accessibles via le profil et le header.
 */
export default function TabsLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? null;
  const visible = visibleTabs(role);
  const center = centerTab(role);
  const href = (name: TabName) => (visible.includes(name) ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textOnDarkMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
        tabBarBackground: () => <GlassTabBar />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Accueil', tabBarIcon: icon('home'), href: href('feed') }} />
      <Tabs.Screen name="search" options={{ title: 'Recherche', tabBarIcon: icon('search'), href: href('search') }} />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Publier',
          href: href('create'),
          // Le bouton central "Publier" ouvre directement le flux /publish
          // (il ne bascule PAS vers l'onglet create, qui n'est qu'un redirect de secours).
          tabBarButton: () => <CenterTabButton icon="plus" label="Publier" onPress={() => router.push('/publish')} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Sauvegardés',
          href: href('saved'),
          tabBarButton:
            center === 'saved' ? (p) => <CenterTabButton icon="bookmark" label="Sauvegardés" onPress={p.onPress} /> : undefined,
          tabBarIcon: icon('bookmark'),
        }}
      />
      <Tabs.Screen name="orders" options={{ title: 'Commandes', tabBarIcon: icon('shopping-bag'), href: href('orders') }} />
      <Tabs.Screen name="portfolio" options={{ href: null }} />
      <Tabs.Screen name="clients" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('user'), href: href('profile') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(23,18,15,0.55)' },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(246,241,233,0.12)',
  },
});
```

Note d'ordre : `feed · search · create · saved · orders · … · profile`. Pour le tailleur `saved` est masqué → l'onglet visible en index 2 est `create`. Pour le client `create` est masqué → l'index 2 est `saved`. Le centre tombe donc toujours au milieu.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. Si `p.onPress` a un type incompatible, vérifier que `CenterTabButton`'s `onPress` est typé `(e: GestureResponderEvent) => void` (Task 2).

- [ ] **Step 4: Run the full mobile test suite (non-régression)**

Run: `cd apps/mobile && npx jest`
Expected: PASS — tous les tests existants + les nouveaux (tabs, CenterTabButton, AppHeader).

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(tabs)/_layout.tsx" "apps/mobile/app/(tabs)/create.tsx"
git commit -m "feat(mobile): barre d'onglets réalignée (centre surélevé, portfolio/clients hors barre)"
```

---

### Task 6: Header permanent + feed sombre sur les écrans d'onglet

Insérer `AppHeader` en haut de chaque écran d'onglet et unifier le feed en sombre (canvas `ink`, cartes claires conservées = Pinterest dark).

**Files:**
- Modify: `apps/mobile/src/feed/Feed.tsx` (fond `surface`→`ink`, retirer le titre « Moodly » inline, couleur de l'état vide)
- Modify: `apps/mobile/app/(tabs)/feed.tsx` (envelopper avec `AppHeader`)
- Modify: `apps/mobile/app/(tabs)/search.tsx` (ajouter `AppHeader` en haut)
- Modify: `apps/mobile/app/(tabs)/saved.tsx` (ajouter `AppHeader` en haut)
- Modify: `apps/mobile/app/(tabs)/orders.tsx` (ajouter `AppHeader` en haut)
- Modify: `apps/mobile/app/(tabs)/profile.tsx` (ajouter `AppHeader` en haut)

**Interfaces:**
- Consumes: `AppHeader` (Task 3).

- [ ] **Step 1: Update `Feed.tsx` — dark canvas, remove inline brand**

Dans `apps/mobile/src/feed/Feed.tsx` :

Remplacer le rendu de retour (le `<ScrollView>…</ScrollView>`) pour supprimer la ligne `<Text style={styles.brand}>Moodly</Text>` :

```tsx
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: spacing.md }]}
      onScroll={onScroll}
      scrollEventThrottle={200}
      showsVerticalScrollIndicator={false}
    >
      {designs.length === 0 ? (
        <Text style={styles.empty}>Aucun modèle pour l'instant.</Text>
      ) : (
        <MasonryColumns designs={designs} onOpen={(id) => onOpenDesign?.(id)} />
      )}
      {hasMore ? <ActivityIndicator style={styles.more} color={colors.accent} /> : null}
    </ScrollView>
  );
```

Puis, dans le `StyleSheet.create` du même fichier, changer `screen` et `empty`, et supprimer `brand` :

```tsx
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { paddingHorizontal: spacing.md, paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
  more: { marginVertical: spacing.lg },
```

(`insets` n'est plus utilisé pour le `paddingTop` du haut car l'`AppHeader` gère la safe-area ; garder l'import `useSafeAreaInsets`/`insets` seulement s'il reste utilisé — sinon retirer la variable pour éviter l'erreur `noUnusedLocals`. Après édition, s'appuyer sur `tsc` à l'étape 3.)

- [ ] **Step 2: Wrap each tab screen with `AppHeader`**

`apps/mobile/app/(tabs)/feed.tsx` :

```tsx
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Feed } from '../../src/feed/Feed';
import { AppHeader } from '../../src/ui/AppHeader';
import { colors } from '../../src/theme';

export default function FeedTab() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <AppHeader />
      <Feed onOpenDesign={(id) => router.push(`/design/${id}`)} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink } });
```

Pour `search.tsx`, `saved.tsx`, `orders.tsx`, `profile.tsx` : ces écrans ont déjà un conteneur racine sombre (`backgroundColor: colors.ink`) avec un `ScrollView`/contenu utilisant `paddingTop: insets.top`. Pour chacun :
1. Importer `AppHeader` : `import { AppHeader } from '../../src/ui/AppHeader';`
2. Envelopper le rendu existant dans un `<View style={{ flex: 1, backgroundColor: colors.ink }}>` avec `<AppHeader />` en premier enfant, puis le contenu existant.
3. Retirer le `insets.top` du `paddingTop` de la zone de contenu (remplacer `insets.top + X` par `X`) puisque l'`AppHeader` couvre déjà la safe-area du haut. Conserver `insets.bottom` là où il est utilisé.

Exemple pour `profile.tsx` (cas connecté — envelopper le `ScrollView`) :

```tsx
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <AppHeader />
      <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: spacing.xl, paddingBottom: 110 }}>
        {/* …contenu existant inchangé… */}
      </ScrollView>
    </View>
  );
```

Et le cas invité (`if (!user)`) de `profile.tsx` : envelopper de même avec `<AppHeader />` au-dessus du bloc existant.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors (corriger tout `insets`/import inutilisé signalé).

- [ ] **Step 4: Run the mobile test suite (non-régression)**

Run: `cd apps/mobile && npx jest`
Expected: PASS. `Feed.test.tsx` ne référence pas le titre « Moodly », donc son retrait n'impacte pas les tests ; les 3 tests de `Feed` restent verts.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/feed/Feed.tsx "apps/mobile/app/(tabs)/feed.tsx" "apps/mobile/app/(tabs)/search.tsx" "apps/mobile/app/(tabs)/saved.tsx" "apps/mobile/app/(tabs)/orders.tsx" "apps/mobile/app/(tabs)/profile.tsx"
git commit -m "feat(mobile): header permanent sur les onglets + feed sombre unifié"
```

---

### Task 7: Portfolio dans le profil tailleur + accès fiches clients

Le profil du tailleur devient sa vitrine : grille de ses modèles + CTA Publier + accès « Mes fiches clients ». Logique extraite dans un composant testable.

**Files:**
- Create: `apps/mobile/src/profile/TailorProfileBody.tsx`
- Test: `apps/mobile/src/profile/TailorProfileBody.test.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx` (brancher `TailorProfileBody` pour le tailleur, retirer la ligne « Ma boutique · Bientôt »)

**Interfaces:**
- Consumes: `MasonryColumns` (`../feed/masonry`), `Design` (`../types`), tokens de thème, `Feather`.
- Produces: `TailorProfileBody({ designs, onPublish, onOpenClients, onOpenDesign }: { designs: Design[]; onPublish: () => void; onOpenClients: () => void; onOpenDesign: (id: string) => void })`. testIDs : `profile-publish`, `profile-clients`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/profile/TailorProfileBody.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TailorProfileBody } from './TailorProfileBody';
import type { Design } from '../types';

const design: Design = {
  id: 'd1', title: 'Boubou fête', description: null, category: 'BOUBOU',
  imageUrl: 'http://x/img.webp', imageWidth: 600, imageHeight: 800,
  likesCount: 0, commentsCount: 0, bookmarksCount: 0, createdAt: '2026-07-14T00:00:00.000Z',
  tailor: { id: 't1', name: 'Modou', avatarUrl: null }, likedByMe: false, bookmarkedByMe: false,
};

function setup(over: Partial<Parameters<typeof TailorProfileBody>[0]> = {}) {
  const props = { designs: [design], onPublish: jest.fn(), onOpenClients: jest.fn(), onOpenDesign: jest.fn(), ...over };
  render(<TailorProfileBody {...props} />);
  return props;
}

describe('TailorProfileBody', () => {
  it('affiche la grille des modèles du tailleur', () => {
    setup();
    expect(screen.getByText('Boubou fête')).toBeTruthy();
  });

  it('propose de publier quand aucun modèle', () => {
    const props = setup({ designs: [] });
    fireEvent.press(screen.getByTestId('profile-publish'));
    expect(props.onPublish).toHaveBeenCalled();
  });

  it('ouvre les fiches clients', () => {
    const props = setup();
    fireEvent.press(screen.getByTestId('profile-clients'));
    expect(props.onOpenClients).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest src/profile/TailorProfileBody.test.tsx`
Expected: FAIL — `Cannot find module './TailorProfileBody'`.

- [ ] **Step 3: Write the component**

```tsx
// apps/mobile/src/profile/TailorProfileBody.tsx
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MasonryColumns } from '../feed/masonry';
import { colors, fonts, radius, spacing } from '../theme';
import type { Design } from '../types';

type Props = {
  designs: Design[];
  onPublish: () => void;
  onOpenClients: () => void;
  onOpenDesign: (id: string) => void;
};

export function TailorProfileBody({ designs, onPublish, onOpenClients, onOpenDesign }: Props) {
  return (
    <View style={styles.root}>
      <Pressable testID="profile-clients" style={styles.clients} onPress={onOpenClients}>
        <Feather name="users" size={18} color={colors.textOnDark} />
        <Text style={styles.clientsText}>Mes fiches clients</Text>
        <Feather name="chevron-right" size={18} color={colors.textOnDarkMuted} />
      </Pressable>

      <View style={styles.head}>
        <Text style={styles.title}>Mes modèles</Text>
        <Pressable testID="profile-publish" style={styles.publish} onPress={onPublish}>
          <Feather name="plus" size={16} color={colors.textOnDark} />
          <Text style={styles.publishText}>Publier</Text>
        </Pressable>
      </View>

      {designs.length === 0 ? (
        <Text style={styles.empty}>Publie ton premier modèle pour le montrer à la communauté.</Text>
      ) : (
        <MasonryColumns designs={designs} onOpen={onOpenDesign} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  clients: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  clientsText: { flex: 1, color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 24 },
  publish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  publishText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  empty: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.md,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx jest src/profile/TailorProfileBody.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into `profile.tsx`**

Dans `apps/mobile/app/(tabs)/profile.tsx` (cas connecté) :
1. Ajouter imports : `import { usePortfolio } from '../../src/designs/hooks';` et `import { TailorProfileBody } from '../../src/profile/TailorProfileBody';`
2. Dans le composant, après `const { user, logout } = useAuth();`, ajouter : `const { designs } = usePortfolio(user?.id);`
3. Remplacer la ligne tailleur `<Row icon="grid" label="Ma boutique" soon />` — au lieu du bloc conditionnel actuel :

```tsx
      <View style={styles.list}>
        <Row icon="edit-3" label="Modifier le profil" soon />
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
```

(Le composant `TailorProfileBody` se place entre la liste des réglages et le bouton « Se déconnecter ».)

- [ ] **Step 6: Typecheck + full suite**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean ; tous les tests verts.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/profile/TailorProfileBody.tsx apps/mobile/src/profile/TailorProfileBody.test.tsx "apps/mobile/app/(tabs)/profile.tsx"
git commit -m "feat(mobile): portfolio + fiches clients dans le profil tailleur"
```

---

### Task 8: Vérification finale (bundle + revue manuelle)

**Files:** aucun (validation).

- [ ] **Step 1: Bundle de production**

Run: `cd apps/mobile && npx expo export --platform ios --output-dir /tmp/moodly-export-jalon6`
Expected: export réussi (bundle généré sans erreur).

- [ ] **Step 2: Suite complète + typecheck**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean ; tous les tests verts.

- [ ] **Step 3: Revue manuelle sur appareil (Expo Go)**

Démarrer l'API (`PUBLIC_BASE_URL=http://<IP_LAN>:3000 npm run dev` dans `apps/api`) + `npm run start` dans `apps/mobile`, scanner le QR. Vérifier :
- **Sans compte** : 3 onglets (Accueil · Recherche · Profil), header avec logo + cloche, feed sombre.
- **Client** (créer/So connecter) : 5 onglets avec **Sauvegardés** surélevé au centre ; header sans icône clients.
- **Tailleur** (`+221770009999` / `secret123`) : 5 onglets avec **⊕ Publier** surélevé au centre → ouvre le flux de publication ; header avec icône fiches clients → ouvre `/clients` ; Profil affiche la grille « Mes modèles » + « Mes fiches clients ».
- Cloche → écran Notifications placeholder.

- [ ] **Step 4: Nettoyer l'export temporaire**

```bash
rm -rf /tmp/moodly-export-jalon6
```

---

## Notes d'implémentation

- **Pas de test de rendu sur `_layout.tsx`** : rendre `<Tabs>` exige le contexte de navigation d'expo-router (lourd et fragile en unité). La logique role→onglets est couverte par les tests purs de la Task 1 ; le rendu réel est validé manuellement (Task 8).
- **`portfolio.tsx` reste dans `app/(tabs)/`** mais avec `href: null` (plus un onglet). Son contenu est désormais dupliqué/remplacé par `TailorProfileBody` dans le profil ; on garde le fichier pour ne casser aucune route, sans y lier de navigation.
- **`clients.tsx` reste dans `app/(tabs)/`** avec `href: null` ; atteint via l'icône du header et le bouton du profil (`/clients`).
