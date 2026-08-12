# Bloc D1 — Détail « pin » social — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l'écran détail en vrai « pin » social — carrousel des médias (bloc A), barre d'actions sociale (like/commentaire/partage/enregistrer), ligne auteur, et « Explorer davantage » (modèles similaires).

**Architecture:** Un nouvel endpoint `GET /designs/:id/similar` (service testable `getSimilarDesigns` : même tailleur d'abord, puis même catégorie). Côté mobile, `DesignScreen` est recomposé à partir de deux unités présentielles testables (`MediaCarousel`, `SocialActionBar`) + un hook `useSimilar`, réutilisant `MasonryColumns`/`DesignCard` pour la grille des similaires.

**Tech Stack:** Express 5 + Prisma 6 (API) ; Expo SDK 54, expo-image (blurhash), React Native `Share`/`ScrollView` (mobile) ; Vitest+Supertest, jest-expo+RNTL.

## Global Constraints

- Prisma 6 pinné. Images **relatives** → toujours via `imageUri()` côté mobile.
- Tokens de thème only (`src/theme.ts`) ; jamais de `fontWeight`.
- Français simple dans l'UI.
- **Piège babel** : pas d'apostrophe courbe U+2019 (’) dans les strings des fichiers **.ts** (casse le tokenizer babel-preset-expo) ; ASCII en `.ts`, `.tsx` tolère U+2019.
- Réutiliser `MasonryColumns` (`src/feed/masonry`) + `DesignCard` pour la grille des similaires.
- Conventions tests API : `createApp()`, helpers `registerUser`/`makeTestImage` (`./helpers.js`), seed en `beforeEach` (setup.ts truncate en beforeEach) ; DB test migrée via `npm test` (pretest `migrate deploy`) — pour un run ciblé : `npx dotenv -e .env.test -- prisma migrate deploy` puis `npx vitest run <fichier>`.
- Ne pas casser les suites (96 API / 42 mobile) ni sortir du périmètre D1 (pas de profil social, pas de lien web, pas de lecteur vidéo).
- Commandes : API depuis `apps/api` ; mobile depuis `apps/mobile`. DB dev = conteneur `moodly-db-1` (`docker compose up -d` si éteint).

---

### Task 1: Backend — modèles similaires (`getSimilarDesigns` + `GET /designs/:id/similar`)

**Files:**
- Modify: `apps/api/src/modules/designs/designs.service.ts`
- Modify: `apps/api/src/modules/designs/designs.routes.ts`
- Create: `apps/api/tests/media-similar.test.ts`

**Interfaces:**
- Consumes: `designInclude`, `toApiDesign`, `prisma`, `ApiError`.
- Produces:
  - `getSimilarDesigns(designId: string, viewerId: string, limit: number): Promise<ReturnType<typeof toApiDesign>[]>` — même tailleur d'abord, puis même catégorie, exclut le courant, dédupliqué, tri `createdAt desc`. 404 si le design n'existe pas.
  - `GET /designs/:id/similar?limit=` → `{ designs }`.

- [ ] **Step 1: S'assurer que la DB dev tourne**

Run: `docker compose up -d`
Expected: `moodly-db-1` Running.

- [ ] **Step 2: Écrire le test qui échoue**

```typescript
// apps/api/tests/media-similar.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function makeDesign(tailorId: string, title: string, category: string) {
  return prisma.design.create({
    data: { tailorId, title, category: category as never, imageUrl: `/uploads/${title}.webp`, imageWidth: 600, imageHeight: 800 },
  });
}

describe('GET /designs/:id/similar', () => {
  let current: { id: string };
  let sameTailor: { id: string };
  let otherTailorSameCat: { id: string };

  beforeEach(async () => {
    const a = await registerUser(app, 'TAILLEUR', '+221770005001');
    const b = await registerUser(app, 'TAILLEUR', '+221770005002');
    current = await makeDesign(a.user.id, 'courant', 'BOUBOU');
    sameTailor = await makeDesign(a.user.id, 'meme-tailleur', 'ROBE');
    otherTailorSameCat = await makeDesign(b.user.id, 'autre-tailleur', 'BOUBOU');
  });

  it('met les modeles du meme tailleur avant ceux de la meme categorie, exclut le courant', async () => {
    const res = await request(app).get(`/designs/${current.id}/similar`);
    expect(res.status).toBe(200);
    const ids = res.body.designs.map((d: { id: string }) => d.id);
    expect(ids).not.toContain(current.id);
    expect(ids[0]).toBe(sameTailor.id);
    expect(ids).toContain(otherTailorSameCat.id);
    expect(new Set(ids).size).toBe(ids.length); // pas de doublon
  });

  it('respecte limit', async () => {
    const res = await request(app).get(`/designs/${current.id}/similar?limit=1`);
    expect(res.body.designs).toHaveLength(1);
  });

  it('404 si le modele nexiste pas', async () => {
    const res = await request(app).get('/designs/inexistant/similar');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Lancer le test (échec attendu)**

Run: `cd apps/api && npx dotenv -e .env.test -- prisma migrate deploy && npx vitest run tests/media-similar.test.ts`
Expected: FAIL (404 pour tous — route absente).

- [ ] **Step 4: Implémenter le service**

Dans `apps/api/src/modules/designs/designs.service.ts`, ajouter (après `toApiDesign`) :

```typescript
export async function getSimilarDesigns(designId: string, viewerId: string, limit: number) {
  const current = await prisma.design.findUnique({
    where: { id: designId },
    select: { id: true, tailorId: true, category: true },
  });
  if (!current) {
    throw new ApiError(404, 'INTROUVABLE', 'Modèle introuvable.');
  }
  const sameTailor = await prisma.design.findMany({
    where: { tailorId: current.tailorId, id: { not: current.id } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: designInclude(viewerId),
  });
  const excludeIds = [current.id, ...sameTailor.map((d) => d.id)];
  const remaining = limit - sameTailor.length;
  const sameCategory =
    remaining > 0
      ? await prisma.design.findMany({
          where: { category: current.category, id: { notIn: excludeIds } },
          orderBy: { createdAt: 'desc' },
          take: remaining,
          include: designInclude(viewerId),
        })
      : [];
  return [...sameTailor, ...sameCategory].map(toApiDesign);
}
```

- [ ] **Step 5: Ajouter la route**

Dans `apps/api/src/modules/designs/designs.routes.ts` : importer le service et ajouter la route près de `GET /:id/comments`.

Ajouter à l'import existant depuis `./designs.service.js` :

```typescript
  getSimilarDesigns,
```

Puis la route (au-dessus de `designsRouter.get('/:id', ...)`) :

```typescript
designsRouter.get('/:id/similar', optionalAuth, async (req, res) => {
  const raw = Number(req.query.limit);
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 12, 1), 30);
  const viewerId = req.user?.sub ?? '';
  const designs = await getSimilarDesigns(req.params.id as string, viewerId, limit);
  res.json({ designs });
});
```

- [ ] **Step 6: Lancer le test (succès attendu) + non-régression**

Run: `cd apps/api && npx vitest run tests/media-similar.test.ts && npx tsc --noEmit && npm test`
Expected: 3 nouveaux tests verts ; typecheck clean ; toute la suite verte.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/designs/designs.service.ts apps/api/src/modules/designs/designs.routes.ts apps/api/tests/media-similar.test.ts
git commit -m "feat(api): endpoint modèles similaires (même tailleur puis catégorie)"
```

---

### Task 2: `MediaCarousel` (mobile) — carrousel paginé + points

**Files:**
- Create: `apps/mobile/src/design/MediaCarousel.tsx`
- Create: `apps/mobile/src/design/MediaCarousel.test.tsx`

**Interfaces:**
- Consumes: `Media` (`../types`), `imageUri` (`../lib/config`), tokens.
- Produces: `MediaCarousel({ media, cover, onDoubleTapLike }: { media: Media[]; cover: { url: string; width: number; height: number; blurhash: string | null }; onDoubleTapLike?: () => void })`. testIDs : `carousel-page` (une par média), `carousel-dots` (si > 1 média). Repli sur `cover` si `media` vide. Double-tap → `onDoubleTapLike`.

- [ ] **Step 1: Écrire le test qui échoue**

```tsx
// apps/mobile/src/design/MediaCarousel.test.tsx
import { render, screen } from '@testing-library/react-native';
import { MediaCarousel } from './MediaCarousel';
import type { Media } from '../types';

const cover = { url: '/uploads/c.webp', width: 600, height: 800, blurhash: null };
function media(n: number): Media[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`, type: 'IMAGE', url: `/uploads/${i}.webp`, thumbnailUrl: null,
    width: 600, height: 800, duration: null, blurhash: null, position: i,
  }));
}

describe('MediaCarousel', () => {
  it('rend une page par media', () => {
    render(<MediaCarousel media={media(3)} cover={cover} />);
    expect(screen.getAllByTestId('carousel-page')).toHaveLength(3);
  });

  it('affiche les points quand plusieurs medias', () => {
    render(<MediaCarousel media={media(3)} cover={cover} />);
    expect(screen.getByTestId('carousel-dots')).toBeTruthy();
  });

  it('masque les points pour un seul media', () => {
    render(<MediaCarousel media={media(1)} cover={cover} />);
    expect(screen.queryByTestId('carousel-dots')).toBeNull();
  });

  it('se replie sur la cover quand media est vide', () => {
    render(<MediaCarousel media={[]} cover={cover} />);
    expect(screen.getAllByTestId('carousel-page')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/mobile && npx jest src/design/MediaCarousel.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `MediaCarousel`**

```tsx
// apps/mobile/src/design/MediaCarousel.tsx
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { imageUri } from '../lib/config';
import { colors, spacing } from '../theme';
import type { Media } from '../types';

type Item = { url: string; width: number; height: number; blurhash: string | null };
type Props = {
  media: Media[];
  cover: Item;
  onDoubleTapLike?: () => void;
};

export function MediaCarousel({ media, cover, onDoubleTapLike }: Props) {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const lastTap = useRef(0);

  const items: Item[] = media.length > 0 ? media : [cover];
  const ratio = items[0].width / items[0].height;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setActive(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function onTap() {
    const now = Date.now();
    if (now - lastTap.current < 280) onDoubleTapLike?.();
    lastTap.current = now;
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {items.map((it, i) => (
          <Pressable key={i} onPress={onTap}>
            <Image
              testID="carousel-page"
              source={{ uri: imageUri(it.url) }}
              placeholder={it.blurhash ? { blurhash: it.blurhash } : undefined}
              style={{ width, aspectRatio: ratio, backgroundColor: colors.inkElevated }}
              contentFit="cover"
              transition={180}
            />
          </Pressable>
        ))}
      </ScrollView>
      {items.length > 1 ? (
        <View testID="carousel-dots" style={styles.dots}>
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(246,241,233,0.5)' },
  dotActive: { backgroundColor: colors.textOnDark, width: 7, height: 7, borderRadius: 3.5 },
});
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd apps/mobile && npx jest src/design/MediaCarousel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/design/MediaCarousel.tsx apps/mobile/src/design/MediaCarousel.test.tsx
git commit -m "feat(mobile): carrousel de médias paginé (détail)"
```

---

### Task 3: `SocialActionBar` (mobile) — barre d'actions présentielle

**Files:**
- Create: `apps/mobile/src/design/SocialActionBar.tsx`
- Create: `apps/mobile/src/design/SocialActionBar.test.tsx`

**Interfaces:**
- Produces: `SocialActionBar({ liked, saved, likesCount, commentsCount, bookmarksCount, onLike, onComment, onShare, onSave })`. testIDs : `action-like`, `action-comment`, `action-share`, `action-save`.

- [ ] **Step 1: Écrire le test qui échoue**

```tsx
// apps/mobile/src/design/SocialActionBar.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SocialActionBar } from './SocialActionBar';

const base = {
  liked: false, saved: false, likesCount: 12, commentsCount: 3, bookmarksCount: 4,
  onLike: jest.fn(), onComment: jest.fn(), onShare: jest.fn(), onSave: jest.fn(),
};

describe('SocialActionBar', () => {
  it('affiche les compteurs', () => {
    render(<SocialActionBar {...base} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('declenche chaque action', () => {
    const props = { ...base, onLike: jest.fn(), onComment: jest.fn(), onShare: jest.fn(), onSave: jest.fn() };
    render(<SocialActionBar {...props} />);
    fireEvent.press(screen.getByTestId('action-like'));
    fireEvent.press(screen.getByTestId('action-comment'));
    fireEvent.press(screen.getByTestId('action-share'));
    fireEvent.press(screen.getByTestId('action-save'));
    expect(props.onLike).toHaveBeenCalled();
    expect(props.onComment).toHaveBeenCalled();
    expect(props.onShare).toHaveBeenCalled();
    expect(props.onSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/mobile && npx jest src/design/SocialActionBar.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `SocialActionBar`**

```tsx
// apps/mobile/src/design/SocialActionBar.tsx
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';

type Props = {
  liked: boolean;
  saved: boolean;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
};

export function SocialActionBar({
  liked, saved, likesCount, commentsCount, bookmarksCount, onLike, onComment, onShare, onSave,
}: Props) {
  return (
    <View style={styles.row}>
      <Pressable testID="action-like" style={styles.action} onPress={onLike}>
        <Feather name="heart" size={22} color={liked ? colors.accent : colors.textOnDark} />
        <Text style={styles.count}>{likesCount}</Text>
      </Pressable>
      <Pressable testID="action-comment" style={styles.action} onPress={onComment}>
        <Feather name="message-circle" size={22} color={colors.textOnDark} />
        <Text style={styles.count}>{commentsCount}</Text>
      </Pressable>
      <Pressable testID="action-share" style={styles.action} onPress={onShare}>
        <Feather name="share" size={22} color={colors.textOnDark} />
      </Pressable>
      <View style={styles.spacer} />
      <Pressable testID="action-save" style={styles.action} onPress={onSave}>
        <Feather name="bookmark" size={22} color={saved ? colors.accent : colors.textOnDark} />
        <Text style={styles.count}>{bookmarksCount}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  spacer: { flex: 1 },
});
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd apps/mobile && npx jest src/design/SocialActionBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/design/SocialActionBar.tsx apps/mobile/src/design/SocialActionBar.test.tsx
git commit -m "feat(mobile): barre d'actions sociale (détail)"
```

---

### Task 4: `useSimilar` + refonte `DesignScreen` + câblage route

**Files:**
- Create: `apps/mobile/src/design/useSimilar.ts`
- Modify: `apps/mobile/src/design/DesignScreen.tsx` (recomposition)
- Modify: `apps/mobile/src/design/Design.test.tsx` (mock `useSimilar` + nouvelles assertions)
- Modify: `apps/mobile/app/design/[id].tsx` (prop `onOpenDesign`)

**Interfaces:**
- Consumes: `MediaCarousel` (Task 2), `SocialActionBar` (Task 3), `useDesign`/`useDesignActions` (existants), `useSimilar` (ci-dessous), `MasonryColumns`, `Share` (react-native).
- Produces:
  - `useSimilar(id: string): { designs: Design[]; isLoading: boolean; isError: boolean }`.
  - `DesignScreen` gagne le prop `onOpenDesign?: (id: string) => void`.

- [ ] **Step 1: Créer `useSimilar`**

```typescript
// apps/mobile/src/design/useSimilar.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { Design } from '../types';

/** Modèles similaires (Explorer davantage) : même tailleur puis même catégorie. */
export function useSimilar(id: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['similar', id],
    queryFn: () => apiFetch<{ designs: Design[] }>(`/designs/${id}/similar`, { token }),
  });
  return { designs: q.data?.designs ?? [], isLoading: q.isLoading, isError: q.isError };
}
```

- [ ] **Step 2: Réécrire le test `DesignScreen` (échec attendu)**

Remplacer `apps/mobile/src/design/Design.test.tsx` par :

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DesignScreen } from './DesignScreen';
import { useDesign } from './useDesign';
import { useSimilar } from './useSimilar';
import type { Design } from '../types';

jest.mock('./useDesign');
jest.mock('./useSimilar');
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, token: 't' }) }));
jest.mock('./useDesignActions', () => ({
  useDesignActions: () => ({
    toggleLike: jest.fn(), toggleBookmark: jest.fn(),
    commentText: '', setCommentText: jest.fn(), submitComment: jest.fn(), commenting: false,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockedUseDesign = useDesign as jest.MockedFunction<typeof useDesign>;
const mockedUseSimilar = useSimilar as jest.MockedFunction<typeof useSimilar>;

function makeDesign(over: Partial<Design> = {}): Design {
  return {
    id: 'd1', title: 'Ensemble Korite', description: 'Bazin riche', category: 'KORITE',
    imageUrl: 'http://x/img.webp', imageWidth: 600, imageHeight: 800,
    coverBlurhash: null, mediaCount: 1, media: [],
    likesCount: 12, commentsCount: 2, bookmarksCount: 4,
    createdAt: '2026-07-11T00:00:00.000Z', tailor: { id: 't1', name: 'Atelier Awa', avatarUrl: null },
    likedByMe: false, bookmarkedByMe: false, ...over,
  };
}

beforeEach(() => {
  mockedUseDesign.mockReturnValue({
    design: makeDesign(), comments: [], isLoading: false, isError: false, refetch: jest.fn(),
  } as ReturnType<typeof useDesign>);
  mockedUseSimilar.mockReturnValue({ designs: [], isLoading: false, isError: false });
});

describe('DesignScreen', () => {
  it('affiche le titre et la barre d actions', () => {
    render(<DesignScreen id="d1" />);
    expect(screen.getByText('Ensemble Korite')).toBeTruthy();
    expect(screen.getByTestId('action-like')).toBeTruthy();
    expect(screen.getByTestId('action-save')).toBeTruthy();
  });

  it('ouvre le profil du tailleur', () => {
    const onTailor = jest.fn();
    render(<DesignScreen id="d1" onTailor={onTailor} />);
    fireEvent.press(screen.getByText(/Atelier Awa/));
    expect(onTailor).toHaveBeenCalledWith('t1');
  });

  it('affiche les similaires et en ouvre un', () => {
    const onOpenDesign = jest.fn();
    mockedUseSimilar.mockReturnValue({ designs: [makeDesign({ id: 'd2', title: 'Boubou fete' })], isLoading: false, isError: false });
    render(<DesignScreen id="d1" onOpenDesign={onOpenDesign} />);
    expect(screen.getByText(/Explorer davantage/i)).toBeTruthy();
    fireEvent.press(screen.getByText('Boubou fete'));
    expect(onOpenDesign).toHaveBeenCalledWith('d2');
  });
});
```

Run: `cd apps/mobile && npx jest src/design/Design.test.tsx`
Expected: FAIL (nouvelle structure pas encore en place).

- [ ] **Step 3: Recomposer `DesignScreen`**

Remplacer `apps/mobile/src/design/DesignScreen.tsx` par :

```tsx
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { MasonryColumns } from '../feed/masonry';
import { colors, fonts, radius, spacing } from '../theme';
import { Button } from '../ui/Button';
import { ErrorRetry } from '../ui/ErrorRetry';
import { MediaCarousel } from './MediaCarousel';
import { SocialActionBar } from './SocialActionBar';
import { useDesign } from './useDesign';
import { useDesignActions } from './useDesignActions';
import { useSimilar } from './useSimilar';

type Props = {
  id: string;
  onRequireAuth?: () => void;
  onBack?: () => void;
  onOrder?: () => void;
  onTailor?: (tailorId: string) => void;
  onOpenDesign?: (id: string) => void;
};

export function DesignScreen({ id, onRequireAuth, onBack, onOrder, onTailor, onOpenDesign }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { design, comments, isLoading, isError, refetch } = useDesign(id);
  const { designs: similar } = useSimilar(id);
  const actions = useDesignActions(id);
  const authed = Boolean(user);
  const gate = onRequireAuth ?? (() => {});

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError || !design) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ErrorRetry message="Impossible de charger ce modèle." onRetry={refetch} dark />
      </View>
    );
  }

  const like = () => (authed ? actions.toggleLike(design.likedByMe) : gate());
  const save = () => (authed ? actions.toggleBookmark(design.bookmarkedByMe) : gate());
  const share = () =>
    Share.share({ message: `${design.title} par ${design.tailor.name} sur Modly` });
  const initial = design.tailor.name.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View>
          <MediaCarousel
            media={design.media}
            cover={{
              url: design.imageUrl,
              width: design.imageWidth,
              height: design.imageHeight,
              blurhash: design.coverBlurhash,
            }}
            onDoubleTapLike={like}
          />
          {onBack ? (
            <Pressable onPress={onBack} style={[styles.back, { top: insets.top + spacing.sm }]} hitSlop={10}>
              <Feather name="chevron-left" size={26} color={colors.textOnDark} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{design.title}</Text>

          <Pressable style={styles.author} onPress={() => onTailor?.(design.tailor.id)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.authorName}>{design.tailor.name}</Text>
            <Feather name="chevron-right" size={18} color={colors.textOnDarkMuted} />
          </Pressable>

          {design.description ? <Text style={styles.description}>{design.description}</Text> : null}

          <SocialActionBar
            liked={design.likedByMe}
            saved={design.bookmarkedByMe}
            likesCount={design.likesCount}
            commentsCount={design.commentsCount}
            bookmarksCount={design.bookmarksCount}
            onLike={like}
            onSave={save}
            onShare={share}
            onComment={() => (authed ? undefined : gate())}
          />

          {similar.length > 0 ? (
            <View style={styles.similar}>
              <Text style={styles.sectionTitle}>Explorer davantage</Text>
              <MasonryColumns designs={similar} onOpen={(sid) => onOpenDesign?.(sid)} />
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Commentaires</Text>
          {authed ? (
            <View style={styles.commentBox}>
              <TextInput
                value={actions.commentText}
                onChangeText={actions.setCommentText}
                placeholder="Ecris un commentaire..."
                placeholderTextColor={colors.textOnDarkMuted}
                style={styles.commentInput}
                multiline
              />
              <Pressable onPress={actions.submitComment} disabled={actions.commenting} style={styles.send}>
                <Feather name="send" size={18} color={colors.textOnDark} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={gate} style={styles.commentGate}>
              <Text style={styles.commentGateText}>Connecte-toi pour commenter</Text>
            </Pressable>
          )}
          {comments.length === 0 ? (
            <Text style={styles.noComments}>Sois le premier a commenter.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <Text style={styles.commentAuthor}>{c.user.name}</Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Commander ce modèle" onPress={() => (authed ? onOrder?.() : gate())} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  back: {
    position: 'absolute',
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.xl },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32 },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  avatar: {
    width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 15 },
  authorName: { flex: 1, color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
  description: {
    color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 16, lineHeight: 24, marginTop: spacing.md,
  },
  similar: { marginTop: spacing.xxl },
  sectionTitle: {
    color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 16, marginTop: spacing.xxl, marginBottom: spacing.md,
  },
  commentBox: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.lg },
  commentInput: {
    flex: 1, minHeight: 46, maxHeight: 120, borderRadius: radius.md, backgroundColor: colors.inkElevated,
    color: colors.textOnDark, paddingHorizontal: spacing.md, paddingTop: spacing.md, fontFamily: fonts.bodyRegular, fontSize: 15,
  },
  send: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  commentGate: {
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.inkLine, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.lg,
  },
  commentGateText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  noComments: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular },
  comment: { marginBottom: spacing.lg },
  commentAuthor: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 13 },
  commentText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, marginTop: 2 },
  cta: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    backgroundColor: colors.ink, borderTopWidth: 1, borderTopColor: colors.inkLine,
  },
});
```

- [ ] **Step 4: Câbler la route**

Dans `apps/mobile/app/design/[id].tsx`, ajouter le prop `onOpenDesign` :

```tsx
    <DesignScreen
      id={id}
      onBack={() => router.back()}
      onRequireAuth={() => router.push('/(auth)/register')}
      onOrder={() => router.push(`/order/create?designId=${id}`)}
      onTailor={(tailorId) => router.push(`/tailor/${tailorId}`)}
      onOpenDesign={(sid) => router.push(`/design/${sid}`)}
    />
```

- [ ] **Step 5: Lancer les tests + typecheck + suite complète**

Run: `cd apps/mobile && npx jest src/design/Design.test.tsx && npx tsc --noEmit && npx jest`
Expected: Design.test 3 tests verts ; typecheck clean ; toute la suite verte.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/design/useSimilar.ts apps/mobile/src/design/DesignScreen.tsx apps/mobile/src/design/Design.test.tsx "apps/mobile/app/design/[id].tsx"
git commit -m "feat(mobile): détail pin social (carrousel, barre sociale, auteur, similaires, partage)"
```

---

### Task 5: Vérification finale (suites + bundle + revue manuelle)

**Files:** aucun (validation).

- [ ] **Step 1: Suites + typecheck (API + mobile)**

Run: `cd apps/api && npx tsc --noEmit && npm test`
Expected: typecheck clean ; API verte (96 + 3 nouveaux).

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean ; mobile verte (42 + carrousel/barre/écran).

- [ ] **Step 2: Bundle de production**

Run: `cd apps/mobile && npx expo export --platform ios --output-dir /tmp/moodly-export-d1`
Expected: export réussi. Puis `rm -rf /tmp/moodly-export-d1`.

- [ ] **Step 3: Revue manuelle (Expo Go)**

API `npm run dev` (apps/api) + `npx expo start --host lan -c` (apps/mobile), scan QR. Vérifier :
- Ouvrir un modèle **à plusieurs images** (en publier un via le tailleur `+221770009999`/`secret123`) → **carrousel** swipe + **points**.
- **Barre d'actions** : like (accent), commentaire, **partage** (feuille native → WhatsApp), enregistrer (accent).
- **Ligne auteur** → ouvre le profil du tailleur.
- **« Explorer davantage »** : grille de similaires (mêmes tailleur/catégorie) ; taper une tuile ouvre son détail.
- **Double-tap** sur l'image → like.

---

## Notes d'implémentation

- **`useSimilar` non testé en direct** : c'est un mince wrapper react-query (comme `useDesign`/`useFeed`, non testés) ; il est couvert via le test `DesignScreen` (mocké) + la vérif manuelle.
- **`onComment`** : dans ce cycle il se contente d'inviter à se connecter si non authentifié (pas de scroll auto — les commentaires sont déjà dans la même page, sous les similaires). Un scroll/focus fin pourra venir en polish.
- **Grille similaires** : réutilise `MasonryColumns`/`DesignCard` → cohérence visuelle avec le feed (tuiles arrondies, badge multi-média, blurhash) sans nouveau composant.
- Le carrousel calcule sa hauteur sur le **1er** média (ratio stable) — les médias de ratios différents sont recadrés (`contentFit="cover"`).
