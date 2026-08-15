# M6 — Mise en valeur du profil tailleur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au tailleur de remplir son profil (édition + photos) et le mettre en valeur avec un rendu « social media » (couverture, avatar, expérience, prix, likes cumulés).

**Architecture:** Backend Express/Prisma : nouveau champ `coverUrl` sur `TailorProfile`, endpoint d'upload photos réutilisant `ImageStorage`, agrégat `likesTotal` sur les routes profil. Mobile Expo/React Native : refonte de `ProfileHero`, écran d'édition, hooks de mutation, câblage.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), Vitest + supertest (API) ; Expo/React Native, @tanstack/react-query, expo-image-picker, Jest + @testing-library/react-native (mobile).

**Spec:** `docs/superpowers/specs/2026-08-14-mvp1-m6-profil-tailleur-design.md`

## Global Constraints

- Messages d'erreur et libellés UI en **français**.
- Commits conventionnels, terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **TDD strict** : test qui échoue d'abord, puis code minimal.
- API : `npm run typecheck` + `npm test` verts. Mobile : `npx tsc --noEmit` + `npx jest` verts.
- Base de test API : Postgres sur `localhost:5433` (docker-compose service `db`). Les autres modules montent leurs routers sans préfixe (`usersRouter`), sauf `tailorsRouter` monté sur `/tailors`.
- Upload : `multer.memoryStorage()`, limite 5 Mo, mimes autorisés `['image/jpeg','image/png','image/webp']`, code `FORMAT_IMAGE_INVALIDE` sinon. Pipeline image = singleton `storage` (`apps/api/src/lib/storage.js`), `storage.save(buffer) → { url, width, height, blurhash }`.

---

### Task 1: Migration — `coverUrl` sur `TailorProfile`

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (modèle `TailorProfile`, ~lignes 46-59)
- Create: `apps/api/prisma/migrations/<timestamp>_add_tailor_cover_url/migration.sql` (généré)

**Interfaces:**
- Produces: colonne `cover_url` nullable sur `tailor_profiles` ; champ Prisma `TailorProfile.coverUrl: string | null`.

- [ ] **Step 1: Ajouter le champ au schéma**

Dans `apps/api/prisma/schema.prisma`, modèle `TailorProfile`, ajouter après `bio`:

```prisma
  bio             String?
  coverUrl        String?
```

- [ ] **Step 2: Générer la migration**

Run:
```bash
cd apps/api && dotenv -e .env.test -- npx prisma migrate dev --name add_tailor_cover_url
```
Expected: nouveau dossier de migration créé, `The migration ... has been applied`, client Prisma régénéré. (Si le serveur DB n'est pas lancé : `docker compose up -d db` à la racine, attendre `pg_isready`.)

- [ ] **Step 3: Vérifier le typecheck**

Run: `cd apps/api && npm run typecheck`
Expected: PASS (le client Prisma connaît `coverUrl`).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): champ coverUrl sur TailorProfile (M6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `likesTotal` + `coverUrl` sur `GET /tailors/:id`

**Files:**
- Modify: `apps/api/src/modules/tailors/tailors.routes.ts` (handler `GET /:id`, ~lignes 53-92)
- Test: `apps/api/tests/tailors.test.ts` (créer si absent)

**Interfaces:**
- Consumes: `TailorProfile.coverUrl` (Task 1), `POST /designs/:id/like` (existant, incrémente `likesCount`).
- Produces: réponse `tailor` inclut `likesTotal: number` ; `tailor.profile.coverUrl` présent.

- [ ] **Step 1: Écrire le test qui échoue**

Créer/compléter `apps/api/tests/tailors.test.ts`:

```typescript
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

async function publish(token: string, title: string) {
  const res = await request(app)
    .post('/designs')
    .set('Authorization', `Bearer ${token}`)
    .field('title', title)
    .field('category', 'BOUBOU')
    .attach('media', await makeTestImage(), 'm.jpg');
  return res.body.design.id as string;
}

describe('GET /tailors/:id — enrichissement M6', () => {
  it('renvoie likesTotal = somme des likes de ses modèles', async () => {
    const { token: tailor, user } = await registerUser(app, 'TAILLEUR', '+221770003001');
    const d1 = await publish(tailor, 'A');
    const d2 = await publish(tailor, 'B');
    const { token: client } = await registerUser(app, 'CLIENT', '+221770003002');
    await request(app).post(`/designs/${d1}/like`).set('Authorization', `Bearer ${client}`);
    await request(app).post(`/designs/${d2}/like`).set('Authorization', `Bearer ${client}`);

    const res = await request(app).get(`/tailors/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tailor.likesTotal).toBe(2);
  });

  it('coverUrl est null par défaut dans le profil', async () => {
    const { token: tailor, user } = await registerUser(app, 'TAILLEUR', '+221770003003');
    await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${tailor}`)
      .send({ bio: 'Bazin riche' });
    const res = await request(app).get(`/tailors/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tailor.profile.coverUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/api && npx vitest run tests/tailors.test.ts`
Expected: FAIL — `likesTotal` undefined (le handler ne le renvoie pas encore).

- [ ] **Step 3: Implémenter l'agrégat**

Dans `apps/api/src/modules/tailors/tailors.routes.ts`, handler `GET /:id`, après le `findMany` des `designs` et avant le `res.json`, ajouter:

```typescript
  const likesAgg = await prisma.design.aggregate({
    where: { tailorId: user.id },
    _sum: { likesCount: true },
  });
```

Puis dans l'objet `tailor` du `res.json`, ajouter le champ:

```typescript
      designsCount: user._count.designs,
      likesTotal: likesAgg._sum.likesCount ?? 0,
```

(`profile: user.tailorProfile` renvoie déjà `coverUrl` grâce à la migration.)

- [ ] **Step 4: Vérifier le succès**

Run: `cd apps/api && npx vitest run tests/tailors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tailors/tailors.routes.ts apps/api/tests/tailors.test.ts
git commit -m "feat(api): likesTotal + coverUrl sur GET /tailors/:id (M6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `likesTotal` sur `GET /me` (tailleur)

**Files:**
- Modify: `apps/api/src/modules/users/users.routes.ts` (handler `GET /me`, ~lignes 28-46)
- Test: `apps/api/tests/users-profile.test.ts` (créer si absent)

**Interfaces:**
- Consumes: `POST /designs/:id/like`, `TailorProfile` (avec `coverUrl`).
- Produces: réponse `GET /me` inclut `likesTotal: number` pour un TAILLEUR.

- [ ] **Step 1: Écrire le test qui échoue**

Créer/compléter `apps/api/tests/users-profile.test.ts`:

```typescript
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

describe('GET /me — likesTotal (M6)', () => {
  it('renvoie la somme des likes des modèles du tailleur', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770004001');
    const pub = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${tailor}`)
      .field('title', 'A')
      .field('category', 'ROBE')
      .attach('media', await makeTestImage(), 'm.jpg');
    const { token: client } = await registerUser(app, 'CLIENT', '+221770004002');
    await request(app).post(`/designs/${pub.body.design.id}/like`).set('Authorization', `Bearer ${client}`);

    const res = await request(app).get('/me').set('Authorization', `Bearer ${tailor}`);
    expect(res.status).toBe(200);
    expect(res.body.likesTotal).toBe(1);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/api && npx vitest run tests/users-profile.test.ts`
Expected: FAIL — `likesTotal` undefined.

- [ ] **Step 3: Implémenter**

Dans `apps/api/src/modules/users/users.routes.ts`, handler `GET /me`, après le `findUnique`, calculer l'agrégat pour un tailleur et l'ajouter à la réponse. Le handler renvoie aujourd'hui l'objet `user`. Ajouter:

```typescript
  const likesTotal =
    user.role === 'TAILLEUR'
      ? (await prisma.design.aggregate({ where: { tailorId: user.id }, _sum: { likesCount: true } }))._sum.likesCount ?? 0
      : 0;
  res.json({ ...user, likesTotal });
```

(Adapter à la forme exacte du `res.json` existant : si la route renvoie déjà `res.json(user)`, la remplacer par la version ci-dessus ; conserver les champs déjà sélectionnés.)

- [ ] **Step 4: Vérifier le succès**

Run: `cd apps/api && npx vitest run tests/users-profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/users/users.routes.ts apps/api/tests/users-profile.test.ts
git commit -m "feat(api): likesTotal sur GET /me pour les tailleurs (M6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Endpoint upload photos — `POST /me/photos`

**Files:**
- Modify: `apps/api/src/modules/users/users.routes.ts` (imports multer/storage + nouvelle route)
- Test: `apps/api/tests/users-photos.test.ts` (créer)

**Interfaces:**
- Consumes: `storage.save(buffer)` (`../../lib/storage.js`), `TailorProfile.coverUrl` (Task 1).
- Produces: `POST /me/photos` (TAILLEUR) accepte champs multipart `avatar` et/ou `cover` ; met à jour `User.avatarUrl` / `TailorProfile.coverUrl` ; réponse `{ avatarUrl: string | null, coverUrl: string | null }`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/api/tests/users-photos.test.ts`:

```typescript
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

describe('POST /me/photos (M6)', () => {
  it('met à jour avatar et couverture', async () => {
    const { token, user } = await registerUser(app, 'TAILLEUR', '+221770005001');
    const res = await request(app)
      .post('/me/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', await makeTestImage(200, 200), 'a.jpg')
      .attach('cover', await makeTestImage(1200, 675), 'c.jpg');
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toMatch(/\/uploads\/.+\.webp$/);
    expect(res.body.coverUrl).toMatch(/\/uploads\/.+\.webp$/);

    const me = await request(app).get(`/tailors/${user.id}`);
    expect(me.body.tailor.avatarUrl).toBe(res.body.avatarUrl);
    expect(me.body.tailor.profile.coverUrl).toBe(res.body.coverUrl);
  });

  it('accepte un seul fichier (avatar seul)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770005002');
    const res = await request(app)
      .post('/me/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', await makeTestImage(), 'a.jpg');
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toMatch(/\.webp$/);
    expect(res.body.coverUrl).toBeNull();
  });

  it('refuse sans fichier (400 IMAGE_REQUISE)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770005003');
    const res = await request(app).post('/me/photos').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMAGE_REQUISE');
  });

  it('refuse un fichier non-image (400 FORMAT_IMAGE_INVALIDE)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770005004');
    const res = await request(app)
      .post('/me/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('pas une image'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FORMAT_IMAGE_INVALIDE');
  });

  it('refuse un client (403)', async () => {
    const { token } = await registerUser(app, 'CLIENT', '+221770005005');
    const res = await request(app)
      .post('/me/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', await makeTestImage(), 'a.jpg');
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/api && npx vitest run tests/users-photos.test.ts`
Expected: FAIL — route inexistante (404 au lieu de 200/400/403).

- [ ] **Step 3: Implémenter la route**

En tête de `apps/api/src/modules/users/users.routes.ts`, ajouter les imports (si absents):

```typescript
import multer from 'multer';
import { storage } from '../../lib/storage.js';
```

Après les autres constantes de module, ajouter la config multer et les mimes:

```typescript
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
```

Ajouter la route (après `PATCH /me/profile`):

```typescript
usersRouter.post(
  '/me/photos',
  requireAuth,
  requireRole('TAILLEUR'),
  photoUpload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const avatarFile = files?.avatar?.[0];
    const coverFile = files?.cover?.[0];
    if (!avatarFile && !coverFile) {
      throw new ApiError(400, 'IMAGE_REQUISE', 'Ajoute au moins une photo.');
    }
    for (const f of [avatarFile, coverFile]) {
      if (f && !PHOTO_MIMES.includes(f.mimetype)) {
        throw new ApiError(400, 'FORMAT_IMAGE_INVALIDE', 'Formats acceptés : JPEG, PNG ou WebP.');
      }
    }

    const userId = req.user!.sub;
    let avatarUrl: string | null = null;
    let coverUrl: string | null = null;

    if (avatarFile) {
      const saved = await storage.save(avatarFile.buffer);
      avatarUrl = saved.url;
      await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    }
    if (coverFile) {
      const saved = await storage.save(coverFile.buffer);
      coverUrl = saved.url;
      await prisma.tailorProfile.upsert({
        where: { userId },
        create: { userId, coverUrl },
        update: { coverUrl },
      });
    }

    // Renvoyer l'état à jour (au cas où un seul des deux a été fourni).
    const fresh = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, tailorProfile: { select: { coverUrl: true } } },
    });
    res.json({
      avatarUrl: fresh?.avatarUrl ?? null,
      coverUrl: fresh?.tailorProfile?.coverUrl ?? null,
    });
  },
);
```

Note : `GET /tailors/:id` renvoie déjà `avatarUrl` (sélectionné sur `user`) — le test `tailor.avatarUrl` passe sans changement.

- [ ] **Step 4: Vérifier le succès**

Run: `cd apps/api && npx vitest run tests/users-photos.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Vérif globale API + commit**

Run: `cd apps/api && npm run typecheck && npm test`
Expected: toute la suite verte.

```bash
git add apps/api/src/modules/users/users.routes.ts apps/api/tests/users-photos.test.ts
git commit -m "feat(api): upload photos profil (avatar + couverture) POST /me/photos (M6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Refonte `ProfileHero` (social media) + types

**Files:**
- Modify: `apps/mobile/src/tailors/hooks.ts` (types `TailorProfile`, `TailorPayload`)
- Modify: `apps/mobile/src/profile/ProfileHero.tsx`
- Test: `apps/mobile/src/profile/ProfileHero.test.tsx`

**Interfaces:**
- Consumes: réponse API enrichie (`coverUrl`, `likesTotal`, `avatarUrl`).
- Produces: `ProfileHero` accepte les nouvelles props `coverUrl`, `avatarUrl`, `yearsExperience`, `priceMin`, `priceMax` (toutes optionnelles / nullables). `TailorProfile` inclut `coverUrl: string | null` ; `TailorPayload.tailor` inclut `likesTotal: number`.

- [ ] **Step 1: Étendre les types**

Dans `apps/mobile/src/tailors/hooks.ts`:

```typescript
export type TailorProfile = {
  bio: string | null;
  coverUrl: string | null;
  location: string | null;
  specialties: string[];
  yearsExperience: number | null;
  priceMin: number | null;
  priceMax: number | null;
  verified: boolean;
} | null;
```

et dans `TailorPayload.tailor`, ajouter `likesTotal: number;` après `designsCount: number;`.

- [ ] **Step 2: Écrire le test qui échoue**

Remplacer/compléter `apps/mobile/src/profile/ProfileHero.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { ProfileHero } from './ProfileHero';

describe('ProfileHero (M6)', () => {
  it('affiche expérience, prix et 3 stats', () => {
    render(
      <ProfileHero
        name="Awa Couture"
        avatarUrl="http://x/a.webp"
        coverUrl="http://x/c.webp"
        yearsExperience={8}
        priceMin={15000}
        stats={[
          { label: 'Modèles', value: 12 },
          { label: 'Abonnés', value: 340 },
          { label: "J'aime", value: 1200 },
        ]}
        specialties={['Mariage']}
      />,
    );
    expect(screen.getByText(/8 ans/i)).toBeTruthy();
    expect(screen.getByText(/15\s?000/)).toBeTruthy();
    expect(screen.getByText("J'aime")).toBeTruthy();
  });

  it('retombe sur l’initiale quand avatarUrl est absent', () => {
    render(<ProfileHero name="Boubacar" />);
    expect(screen.getByText('B')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Vérifier l'échec**

Run: `cd apps/mobile && npx jest src/profile/ProfileHero.test.tsx`
Expected: FAIL — props/rendu expérience+prix absents.

- [ ] **Step 4: Implémenter la refonte**

Dans `apps/mobile/src/profile/ProfileHero.tsx`, étendre `Props` et le rendu. Ajouter aux props:

```tsx
type Props = {
  name: string;
  roleLabel?: string;
  location?: string | null;
  verified?: boolean;
  stats?: Stat[];
  bio?: string | null;
  specialties?: string[];
  avatarUrl?: string | null;
  coverUrl?: string | null;
  yearsExperience?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
};
```

Importer `Image` d'`expo-image` (déjà utilisé ailleurs, ex. `publish.tsx`) :

```tsx
import { Image } from 'expo-image';
```

Rendu :
- **Bannière** en haut du hero : si `coverUrl`, `<Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />`, sinon une `View` avec fond `colors.inkElevated` (repli). Hauteur ~140, largeur pleine, coins bas arrondis facultatifs.
- **Avatar** : si `avatarUrl`, `<Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />` à la place du bloc initiale ; sinon garder le bloc initiale existant. L'avatar chevauche la bannière (`marginTop: -46` p. ex.).
- **Expérience** : sous la localisation, si `yearsExperience`, afficher `<Text style={styles.meta}>{yearsExperience} ans d'expérience</Text>`.
- **Prix** : helper d'affichage :

```tsx
function formatPrice(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => n.toLocaleString('fr-FR');
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)} FCFA`;
  if (min != null) return `À partir de ${fmt(min)} FCFA`;
  return `Jusqu'à ${fmt(max as number)} FCFA`;
}
```
Afficher `<Text style={styles.meta}>{formatPrice(priceMin, priceMax)}</Text>` si non-null.

Ajouter les styles `cover`, `avatar` (image), `meta` (couleur `colors.textOnDarkMuted`). Garder les 3 stats via la prop `stats` existante (le parent passe 3 entrées).

- [ ] **Step 5: Vérifier le succès**

Run: `cd apps/mobile && npx jest src/profile/ProfileHero.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/tailors/hooks.ts apps/mobile/src/profile/ProfileHero.tsx apps/mobile/src/profile/ProfileHero.test.tsx
git commit -m "feat(mobile): ProfileHero social media (couverture, avatar, expérience, prix, 3 stats) (M6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Hooks d'édition — `useUpdateProfile` + `useUploadProfilePhotos`

**Files:**
- Create: `apps/mobile/src/profile/hooks.ts`
- Create: `apps/mobile/src/profile/buildPhotosForm.ts`
- Test: `apps/mobile/src/profile/hooks.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `apiUpload` (`../lib/api`), `useAuth`.
- Produces:
  - `type ProfileInput = { bio?; location?; specialties?; yearsExperience?; priceMin?; priceMax? }`
  - `useUpdateProfile(): { save(input: ProfileInput): Promise<unknown>; saving: boolean }` → `PATCH /me/profile`.
  - `useUploadProfilePhotos(): { upload(input: { avatarUri?; coverUri? }): Promise<{ avatarUrl; coverUrl }>; uploading: boolean }` → `POST /me/photos`.
  - `buildPhotosForm({ avatarUri?, coverUri? }): FormData`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/mobile/src/profile/hooks.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { apiFetch, apiUpload } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useUpdateProfile, useUploadProfilePhotos } from './hooks';

jest.mock('../lib/api');
jest.mock('../auth/AuthContext');

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockedUpload = apiUpload as jest.MockedFunction<typeof apiUpload>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ token: 'tok' } as never);
});

it('useUpdateProfile PATCH /me/profile avec le corps + token', async () => {
  mockedFetch.mockResolvedValue({} as never);
  const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper() });
  await act(async () => {
    await result.current.save({ bio: 'Bazin', priceMin: 15000 });
  });
  expect(mockedFetch).toHaveBeenCalledWith(
    '/me/profile',
    expect.objectContaining({ method: 'PATCH', token: 'tok', body: { bio: 'Bazin', priceMin: 15000 } }),
  );
});

it('useUploadProfilePhotos POST /me/photos en multipart', async () => {
  mockedUpload.mockResolvedValue({ avatarUrl: 'a', coverUrl: null } as never);
  const { result } = renderHook(() => useUploadProfilePhotos(), { wrapper: wrapper() });
  await act(async () => {
    await result.current.upload({ avatarUri: 'file:///a.jpg' });
  });
  expect(mockedUpload).toHaveBeenCalledWith('/me/photos', expect.any(FormData), 'tok');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/mobile && npx jest src/profile/hooks.test.tsx`
Expected: FAIL — module `./hooks` introuvable.

- [ ] **Step 3: Implémenter `buildPhotosForm`**

Créer `apps/mobile/src/profile/buildPhotosForm.ts`:

```typescript
function fileFromUri(uri: string) {
  const name = uri.split('/').pop() ?? 'photo.jpg';
  const ext = (name.split('.').pop() ?? 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { uri, name, type };
}

export function buildPhotosForm(input: { avatarUri?: string; coverUri?: string }): FormData {
  const form = new FormData();
  if (input.avatarUri) form.append('avatar', fileFromUri(input.avatarUri) as unknown as Blob);
  if (input.coverUri) form.append('cover', fileFromUri(input.coverUri) as unknown as Blob);
  return form;
}
```

- [ ] **Step 4: Implémenter `hooks.ts`**

Créer `apps/mobile/src/profile/hooks.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, apiUpload } from '../lib/api';
import { buildPhotosForm } from './buildPhotosForm';

export type ProfileInput = {
  bio?: string;
  location?: string;
  specialties?: string[];
  yearsExperience?: number;
  priceMin?: number;
  priceMax?: number;
};

function useInvalidateProfile() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['tailor'] });
    qc.invalidateQueries({ queryKey: ['me'] });
  };
}

export function useUpdateProfile() {
  const { token } = useAuth();
  const invalidate = useInvalidateProfile();
  const m = useMutation({
    mutationFn: (input: ProfileInput) =>
      apiFetch('/me/profile', { method: 'PATCH', token, body: input }),
    onSuccess: invalidate,
  });
  return { save: (input: ProfileInput) => m.mutateAsync(input), saving: m.isPending };
}

export function useUploadProfilePhotos() {
  const { token } = useAuth();
  const invalidate = useInvalidateProfile();
  const m = useMutation({
    mutationFn: (input: { avatarUri?: string; coverUri?: string }) =>
      apiUpload<{ avatarUrl: string | null; coverUrl: string | null }>(
        '/me/photos',
        buildPhotosForm(input),
        token,
      ),
    onSuccess: invalidate,
  });
  return { upload: (input: { avatarUri?: string; coverUri?: string }) => m.mutateAsync(input), uploading: m.isPending };
}
```

- [ ] **Step 5: Vérifier le succès**

Run: `cd apps/mobile && npx jest src/profile/hooks.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/profile/hooks.ts apps/mobile/src/profile/buildPhotosForm.ts apps/mobile/src/profile/hooks.test.tsx
git commit -m "feat(mobile): hooks édition profil (useUpdateProfile, useUploadProfilePhotos) (M6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Écran d'édition du profil — `app/profile/edit.tsx`

**Files:**
- Create: `apps/mobile/app/profile/edit.tsx`
- Create: `apps/mobile/src/profile/validateProfile.ts`
- Test: `apps/mobile/src/profile/validateProfile.test.ts`

**Interfaces:**
- Consumes: `useUpdateProfile`, `useUploadProfilePhotos` (Task 6), `useTailorProfile` (valeurs initiales), `expo-image-picker`.
- Produces: `validateProfile(input): string | null` (message d'erreur FR ou `null`) ; route Expo `/profile/edit`.

- [ ] **Step 1: Écrire le test qui échoue (validation)**

Créer `apps/mobile/src/profile/validateProfile.test.ts`:

```typescript
import { validateProfile } from './validateProfile';

describe('validateProfile', () => {
  it('rejette prix min > prix max', () => {
    expect(validateProfile({ priceMin: 20000, priceMax: 10000 })).toMatch(/prix minimum/i);
  });
  it('rejette une bio trop longue', () => {
    expect(validateProfile({ bio: 'x'.repeat(501) })).toMatch(/bio/i);
  });
  it('accepte une saisie valide', () => {
    expect(validateProfile({ bio: 'Bazin', priceMin: 10000, priceMax: 20000 })).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/mobile && npx jest src/profile/validateProfile.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `validateProfile`**

Créer `apps/mobile/src/profile/validateProfile.ts`:

```typescript
import type { ProfileInput } from './hooks';

export function validateProfile(input: ProfileInput): string | null {
  if (input.bio != null && input.bio.length > 500) return 'La bio ne doit pas dépasser 500 caractères.';
  if (input.location != null && input.location.length > 120) return 'La localisation est trop longue.';
  if (input.yearsExperience != null && (input.yearsExperience < 0 || input.yearsExperience > 80))
    return "Les années d'expérience sont invalides.";
  if (input.priceMin != null && input.priceMin < 0) return 'Le prix minimum est invalide.';
  if (input.priceMax != null && input.priceMax < 0) return 'Le prix maximum est invalide.';
  if (input.priceMin != null && input.priceMax != null && input.priceMin > input.priceMax)
    return 'Le prix minimum doit être inférieur au prix maximum.';
  return null;
}
```

- [ ] **Step 4: Vérifier le succès (validation)**

Run: `cd apps/mobile && npx jest src/profile/validateProfile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implémenter l'écran**

Créer `apps/mobile/app/profile/edit.tsx`. Structure (suivre le style de `app/publish.tsx` pour le picker et `TextField` de `src/ui/TextField.tsx` pour les champs) :

- `useLocalSearchParams` non nécessaire ; charge les valeurs initiales via `useTailorProfile(user.id)`.
- État local : `bio`, `location`, `specialties` (tableau), `yearsExperience`, `priceMin`, `priceMax`, `avatarUri`, `coverUri`.
- Boutons « Changer l'avatar » / « Changer la couverture » → `ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9, aspect: [1,1] /* [16,9] pour la couverture */ })`, stocke l'URI choisie.
- Bouton « Enregistrer » :
  1. `const err = validateProfile({...})` ; si `err`, afficher le message et stopper.
  2. Si `avatarUri` ou `coverUri` : `await upload({ avatarUri, coverUri })`.
  3. `await save({ bio, location, specialties, yearsExperience, priceMin, priceMax })` (ne passer que les champs renseignés).
  4. `router.back()`.
- Réserver l'accès au rôle TAILLEUR (rediriger sinon).
- Thème sombre (`theme.ts`), cohérent avec les autres écrans.

> Note design : au moment d'implémenter cet écran ET la refonte visuelle de `ProfileHero`, invoquer le skill `frontend-design:frontend-design` pour un rendu « social media » soigné.

- [ ] **Step 6: Vérifier typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/profile/edit.tsx apps/mobile/src/profile/validateProfile.ts apps/mobile/src/profile/validateProfile.test.ts
git commit -m "feat(mobile): écran d'édition du profil tailleur (photos + champs) (M6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Câblage onglet Profil + `tailor/[id]`

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/app/tailor/[id].tsx`
- Test: `apps/mobile/app/(tabs)/__tests__/profile.test.tsx` (créer) OU test léger sur le bouton

**Interfaces:**
- Consumes: `ProfileHero` (nouvelles props, Task 5), route `/profile/edit` (Task 7), `useTailorProfile` (avec `likesTotal`, `coverUrl`).
- Produces: onglet Profil affiche 3 stats + couverture/avatar + bouton « Modifier le profil » (TAILLEUR) ; `tailor/[id]` affiche le profil enrichi.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/mobile/app/(tabs)/__tests__/profile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import ProfileTab from '../profile';
import { useAuth } from '../../../src/auth/AuthContext';
import { useTailorProfile } from '../../../src/tailors/hooks';

jest.mock('../../../src/auth/AuthContext');
jest.mock('../../../src/tailors/hooks');
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

(useAuth as jest.Mock).mockReturnValue({
  user: { id: 't1', name: 'Awa', role: 'TAILLEUR' },
  logout: jest.fn(),
});
(useTailorProfile as jest.Mock).mockReturnValue({
  tailor: { id: 't1', name: 'Awa', avatarUrl: null, likesTotal: 42, designsCount: 5, followersCount: 9, profile: null },
  designs: [],
});

it('affiche le bouton Modifier le profil pour un tailleur', () => {
  render(<ProfileTab />);
  expect(screen.getByText(/Modifier le profil/i)).toBeTruthy();
});
```

(Si `AppHeader` casse le rendu en test, ajouter `jest.mock('../../../src/ui/AppHeader', () => ({ AppHeader: () => null }));`.)

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/mobile && npx jest "app/(tabs)/__tests__/profile.test.tsx"`
Expected: FAIL — bouton absent.

- [ ] **Step 3: Implémenter le câblage**

Dans `apps/mobile/app/(tabs)/profile.tsx` (branche TAILLEUR) :
- Passer à `ProfileHero` : `avatarUrl={tailor?.avatarUrl}`, `coverUrl={tailor?.profile?.coverUrl}`, `yearsExperience={tailor?.profile?.yearsExperience}`, `priceMin={tailor?.profile?.priceMin}`, `priceMax={tailor?.profile?.priceMax}`, et `stats` à 3 entrées incluant `{ label: "J'aime", value: tailor?.likesTotal ?? 0 }`.
- Ajouter un bouton « Modifier le profil » (visible si `user.role === 'TAILLEUR'`) → `router.push('/profile/edit')`.

Dans `apps/mobile/app/tailor/[id].tsx` : passer les mêmes nouvelles props à `ProfileHero` et ajouter la 3ᵉ stat « J'aime » depuis `tailor.likesTotal`.

- [ ] **Step 4: Vérifier le succès**

Run: `cd apps/mobile && npx jest "app/(tabs)/__tests__/profile.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Vérif globale mobile + commit**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: toute la suite verte.

```bash
git add "apps/mobile/app/(tabs)/profile.tsx" "apps/mobile/app/tailor/[id].tsx" "apps/mobile/app/(tabs)/__tests__/profile.test.tsx"
git commit -m "feat(mobile): câble profil enrichi + bouton Modifier le profil (M6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes d'exécution

- **Base de test API** : nécessite Postgres sur `localhost:5433`. Sur cette machine, ce port peut être occupé par un autre projet (`dahira-postgres`) ; le libérer avant, le restaurer après.
- **Ordre** : Tasks 1→4 (backend) puis 5→8 (mobile). Task 5 étend les types consommés par 6→8.
- **Design** : pour les Tasks 5 et 7 (rendu visuel), invoquer `frontend-design:frontend-design` — objectif « profil créateur social media », thème sombre.
