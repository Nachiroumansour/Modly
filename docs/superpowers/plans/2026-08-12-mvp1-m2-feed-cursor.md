# MVP1 · M2 — Feed curseur + Abonnements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Passer le feed Accueil en pagination **curseur** et ajouter un onglet **Abonnements** (modèles des tailleurs suivis), sans casser la recherche (offset).

**Architecture:** `GET /designs` discrimine par la présence de `page` : offset (recherche) sinon curseur (feed). Ajout `cursor` + `following`. Mobile : `useFeed(scope)` en curseur + segmenté `FeedTabs` « Pour vous | Abonnements ».

**Tech Stack:** Express 5 + Prisma 6 ; Expo SDK 54 (react-query useInfiniteQuery) ; Vitest+Supertest, jest-expo+RNTL.

## Global Constraints

- Prisma 6 ; images relatives (`imageUri`). Migrations/bundle **Node 20** ; tests API via `npm test` (pretest migrate). Piège babel : ASCII dans les `.ts`.
- Ne pas casser `useSearch` (offset) ni les suites (API 110 / mobile 71). Tokens de thème ; jamais de `fontWeight`.
- Conventions tests API : `createApp()`, helpers `registerUser`/`makeTestImage`, seed `beforeEach`.

---

### Task 1: Backend — curseur + `following` sur `GET /designs`

**Files:**
- Modify: `apps/api/src/modules/designs/designs.routes.ts`
- Create: `apps/api/tests/feed-cursor.test.ts`

**Interfaces:**
- Produces : `GET /designs` — si `page` → offset `{ designs, page, hasMore }` (inchangé) ; sinon curseur `{ designs, nextCursor }` (tri `createdAt desc, id desc`). `?following=1` (auth) filtre les tailleurs suivis (401 sans auth).

- [ ] **Step 1: DB dev + test qui échoue**

Run: `docker compose up -d`

```typescript
// apps/api/tests/feed-cursor.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function design(tailorId: string, title: string) {
  return prisma.design.create({
    data: { tailorId, title, category: 'ROBE', imageUrl: `/uploads/${title}.webp`, imageWidth: 600, imageHeight: 800 },
  });
}

describe('feed curseur', () => {
  let tailorId: string;
  beforeEach(async () => {
    const t = await registerUser(app, 'TAILLEUR', '+221770008001');
    tailorId = t.user.id;
    await design(tailorId, 'a');
    await design(tailorId, 'b');
    await design(tailorId, 'c');
  });

  it('pagine par curseur sans doublon', async () => {
    const p1 = await request(app).get('/designs?limit=2');
    expect(p1.status).toBe(200);
    expect(p1.body.designs).toHaveLength(2);
    expect(p1.body.nextCursor).toEqual(expect.any(String));

    const p2 = await request(app).get(`/designs?limit=2&cursor=${p1.body.nextCursor}`);
    const ids1 = p1.body.designs.map((d: { id: string }) => d.id);
    const ids2 = p2.body.designs.map((d: { id: string }) => d.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toHaveLength(0);
    expect(p2.body.nextCursor).toBeNull();
  });

  it('mode page (recherche) renvoie page/hasMore', async () => {
    const res = await request(app).get('/designs?page=1&limit=2');
    expect(res.body).toMatchObject({ page: 1 });
    expect(typeof res.body.hasMore).toBe('boolean');
  });
});

describe('feed abonnements', () => {
  it('ne renvoie que les tailleurs suivis, 401 sans auth', async () => {
    const a = await registerUser(app, 'TAILLEUR', '+221770008010');
    const b = await registerUser(app, 'TAILLEUR', '+221770008011');
    await design(a.user.id, 'suivi');
    await design(b.user.id, 'pasSuivi');
    const client = await registerUser(app, 'CLIENT', '+221770008012');
    await request(app).post(`/tailors/${a.user.id}/follow`).set('Authorization', `Bearer ${client.token}`);

    const anon = await request(app).get('/designs?following=1');
    expect(anon.status).toBe(401);

    const res = await request(app).get('/designs?following=1').set('Authorization', `Bearer ${client.token}`);
    const titles = res.body.designs.map((d: { title: string }) => d.title);
    expect(titles).toContain('suivi');
    expect(titles).not.toContain('pasSuivi');
  });
});
```

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx dotenv -e .env.test -- prisma migrate deploy && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx vitest run tests/feed-cursor.test.ts` → FAIL.

- [ ] **Step 2: Modifier `feedQuerySchema` + le handler**

Dans `apps/api/src/modules/designs/designs.routes.ts`, `feedQuerySchema` :

```typescript
const feedQuerySchema = z.object({
  category: z.enum(DESIGN_CATEGORIES).optional(),
  search: z.string().min(1).max(80).optional(),
  sort: z.enum(['recent', 'tendance']).default('recent'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  following: z.string().optional(),
});
```

Remplacer le corps du handler `designsRouter.get('/', optionalAuth, …)` (après le parse) par :

```typescript
  const { category, search, sort, page, limit, cursor, following } = parsed.data;
  const viewerId = req.user?.sub ?? '';
  const isFollowing = following === '1';

  if (isFollowing && !req.user) {
    throw new ApiError(401, 'NON_AUTHENTIFIE', 'Connecte-toi pour voir tes abonnements.');
  }

  const where: Record<string, unknown> = {
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  if (isFollowing) {
    const follows = await prisma.follow.findMany({ where: { followerId: viewerId }, select: { tailorId: true } });
    where.tailorId = { in: follows.map((f) => f.tailorId) };
  }

  if (page !== undefined) {
    const orderBy =
      sort === 'tendance'
        ? [{ likesCount: 'desc' as const }, { id: 'desc' as const }]
        : [{ id: 'desc' as const }];
    const rows = await prisma.design.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit + 1, include: designInclude(viewerId) });
    const hasMore = rows.length > limit;
    res.json({ designs: rows.slice(0, limit).map(toApiDesign), page, hasMore });
    return;
  }

  const rows = await prisma.design.findMany({
    where,
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: designInclude(viewerId),
  });
  const nextCursor = rows.length > limit ? rows[limit - 1].id : null;
  res.json({ designs: rows.slice(0, limit).map(toApiDesign), nextCursor });
```

- [ ] **Step 3: Vert + non-régression**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx vitest run tests/feed-cursor.test.ts && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx tsc --noEmit && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npm test`
Expected: nouveaux tests verts ; suite verte (les tests feed existants utilisent `page=1` → mode offset inchangé).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/designs/designs.routes.ts apps/api/tests/feed-cursor.test.ts
git commit -m "feat(api): feed pagination curseur + filtre abonnements (following)"
```

---

### Task 2: Mobile — `useFeed(scope)` en curseur + type `FeedPage`

**Files:**
- Modify: `apps/mobile/src/types.ts`
- Modify: `apps/mobile/src/feed/useFeed.ts`

**Interfaces:**
- Produces : `type FeedPage = { designs: Design[]; nextCursor: string | null }` ; `useFeed(scope: 'foryou' | 'following' = 'foryou')` (curseur).

- [ ] **Step 1: Type**

Dans `apps/mobile/src/types.ts` :

```typescript
export type FeedPage = { designs: Design[]; nextCursor: string | null };
```

- [ ] **Step 2: `useFeed` curseur**

Remplacer `apps/mobile/src/feed/useFeed.ts` par :

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { Design, FeedPage } from '../types';

const LIMIT = 20;
export type FeedScope = 'foryou' | 'following';

/** Feed paginé par curseur. scope 'following' = modèles des tailleurs suivis (auth). */
export function useFeed(scope: FeedScope = 'foryou') {
  const { token } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ['feed', scope],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const parts = [`limit=${LIMIT}`];
      if (pageParam) parts.push(`cursor=${pageParam}`);
      if (scope === 'following') parts.push('following=1');
      return apiFetch<FeedPage>(`/designs?${parts.join('&')}`, scope === 'following' ? { token } : {});
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const designs: Design[] = query.data?.pages.flatMap((p) => p.designs) ?? [];

  return {
    designs,
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: Boolean(query.hasNextPage),
    refetch: () => query.refetch(),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
  };
}
```

- [ ] **Step 3: Typecheck + suite (Feed.test mock useFeed → OK)**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: clean + verte (Feed.test mocke `useFeed`, signature compatible).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/types.ts apps/mobile/src/feed/useFeed.ts
git commit -m "feat(mobile): useFeed en pagination curseur + scope abonnements"
```

---

### Task 3: Mobile — `FeedTabs` + branchement Accueil

**Files:**
- Create: `apps/mobile/src/feed/FeedTabs.tsx`
- Create: `apps/mobile/src/feed/FeedTabs.test.tsx`
- Modify: `apps/mobile/src/feed/Feed.tsx` (prop `scope` + état vide selon scope)
- Modify: `apps/mobile/app/(tabs)/feed.tsx` (segmenté + gate)

**Interfaces:**
- Produces : `FeedTabs({ scope, onChange, showFollowing })` (testIDs `tab-foryou`, `tab-following`). `Feed` gagne un prop `scope?: FeedScope`.

- [ ] **Step 1: Test `FeedTabs` (échec attendu)**

```tsx
// apps/mobile/src/feed/FeedTabs.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FeedTabs } from './FeedTabs';

describe('FeedTabs', () => {
  it('affiche les deux onglets et bascule', () => {
    const onChange = jest.fn();
    render(<FeedTabs scope="foryou" onChange={onChange} showFollowing />);
    expect(screen.getByTestId('tab-foryou')).toBeTruthy();
    fireEvent.press(screen.getByTestId('tab-following'));
    expect(onChange).toHaveBeenCalledWith('following');
  });
});
```

Run: `cd apps/mobile && npx jest src/feed/FeedTabs.test.tsx` → FAIL.

- [ ] **Step 2: `FeedTabs`**

```tsx
// apps/mobile/src/feed/FeedTabs.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import type { FeedScope } from './useFeed';

type Props = {
  scope: FeedScope;
  onChange: (scope: FeedScope) => void;
  showFollowing: boolean;
};

export function FeedTabs({ scope, onChange, showFollowing }: Props) {
  return (
    <View style={styles.row}>
      <Tab label="Pour vous" active={scope === 'foryou'} onPress={() => onChange('foryou')} testID="tab-foryou" />
      {showFollowing ? (
        <Tab label="Abonnements" active={scope === 'following'} onPress={() => onChange('following')} testID="tab-following" />
      ) : null}
    </View>
  );
}

function Tab({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  tab: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.inkElevated },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  tabTextActive: { color: colors.textOnDark },
});
```

Run: `cd apps/mobile && npx jest src/feed/FeedTabs.test.tsx` → PASS.

- [ ] **Step 3: `Feed` accepte `scope` + état vide contextuel**

Dans `apps/mobile/src/feed/Feed.tsx` : ajouter le prop `scope` et le passer à `useFeed`, et rendre l'état vide dépendant du scope.

```tsx
import { useFeed, type FeedScope } from './useFeed';
// ...
type FeedProps = { onOpenDesign?: (id: string) => void; scope?: FeedScope };

export function Feed({ onOpenDesign, scope = 'foryou' }: FeedProps = {}) {
  const insets = useSafeAreaInsets();
  const { designs, isLoading, isError, hasMore, refetch, loadMore } = useFeed(scope);
  // ... (inchangé) ...
```

Dans le bloc vide, remplacer le texte par :

```tsx
        {designs.length === 0 ? (
          <Text style={styles.empty}>
            {scope === 'following'
              ? 'Suis des tailleurs pour voir leurs nouveautes ici.'
              : "Aucun modele pour l'instant."}
          </Text>
        ) : (
```

- [ ] **Step 4: Segmenté + gate dans `feed.tsx`**

Remplacer `apps/mobile/app/(tabs)/feed.tsx` par :

```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { Feed } from '../../src/feed/Feed';
import { FeedTabs } from '../../src/feed/FeedTabs';
import type { FeedScope } from '../../src/feed/useFeed';
import { colors } from '../../src/theme';
import { AppHeader } from '../../src/ui/AppHeader';

export default function FeedTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [scope, setScope] = useState<FeedScope>('foryou');

  function changeScope(s: FeedScope) {
    if (s === 'following' && !user) {
      router.push('/(auth)/register');
      return;
    }
    setScope(s);
  }

  return (
    <View style={styles.root}>
      <AppHeader />
      <FeedTabs scope={scope} onChange={changeScope} showFollowing />
      <Feed scope={scope} onOpenDesign={(id) => router.push(`/design/${id}`)} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink } });
```

- [ ] **Step 5: Typecheck + suite complète**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: clean + verte (FeedTabs + Feed + reste).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/feed/FeedTabs.tsx apps/mobile/src/feed/FeedTabs.test.tsx apps/mobile/src/feed/Feed.tsx "apps/mobile/app/(tabs)/feed.tsx"
git commit -m "feat(mobile): segmenté Pour vous / Abonnements sur l'accueil"
```

---

### Task 4: Vérification finale

- [ ] **Step 1: Suites + typecheck**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx tsc --noEmit && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npm test`
Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: API verte (110 + feed-cursor) ; mobile verte (71 + FeedTabs).

- [ ] **Step 2: Bundle (Node 20)**

Run: `cd apps/mobile && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx expo export --platform ios --output-dir /tmp/moodly-m2` ; vérifier le `.hbc` ; `rm -rf /tmp/moodly-m2`.

- [ ] **Step 3: Revue manuelle (Expo Go, Node 20)**

Accueil : segmenté **Pour vous | Abonnements** ; « Pour vous » défile à l'infini (curseur, sans doublon/saut) ; connecté et suivant un atelier, « Abonnements » ne montre que leurs modèles ; sans compte, taper « Abonnements » invite à se connecter ; « Abonnements » vide → message.

---

## Notes d'implémentation

- **Discriminateur `page`** : la recherche passe toujours `page` → mode offset intact ; le feed ne passe jamais `page` → curseur.
- **`following` sans suivis** → `where.tailorId in []` → 0 modèle → état vide.
- « Pour vous » reste **chronologique** (curseur `createdAt/id`) ; le vrai algo = plus tard.
- `useSearch` n'est pas touché.
