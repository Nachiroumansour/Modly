# MVP1 · M1 — Collections nommées — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remplacer les « Sauvegardés » à plat par des **collections privées** (boards façon Pinterest) : créer/renommer/supprimer, ranger un modèle enregistré dans une collection, et un onglet Enregistrés = grille de cartes-collections à couverture mosaïque.

**Architecture:** Table `Collection` (par client) + `Bookmark.collectionId` nullable. API CRUD collections + `PATCH /me/bookmarks/:designId` (upsert + range). Mobile : helper d'agencement `mosaicSlots`, `CollectionCard`/`MosaicCover`, hooks react-query, refonte de l'onglet Enregistrés, écran détail collection, et `CollectionPickerSheet` (bottom sheet).

**Tech Stack:** Express 5 + Prisma 6 + PostgreSQL ; Expo SDK 54, expo-image, RN Modal ; Vitest+Supertest, jest-expo+RNTL.

## Global Constraints

- **Prisma 6 pinné.** Migrations + `expo export` sous **Node 20** (`PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" …` ou `nvm use 20`) — le shell retombe sur node 18. Tests API via `npm test` (pretest applique `migrate deploy`).
- Images **relatives** → toujours via `imageUri()` côté mobile.
- Tokens de thème only ; jamais de `fontWeight`.
- **Piège babel** : pas d'apostrophe courbe U+2019 dans les strings des fichiers **.ts** ; `.tsx` tolère.
- Réutiliser `MasonryColumns`/`DesignCard` (grilles) et le patron `CommentsSheet` (bottom sheet).
- Conventions tests API : `createApp()`, helpers `registerUser`/`makeTestImage`, seed en `beforeEach`.
- Ne pas casser les suites (API 105 / mobile 65). Propriété stricte : une ressource d'un autre → **404**.

---

### Task 1: Schéma — `Collection` + `Bookmark.collectionId` + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration `…_add_collections/migration.sql` (généré)

**Interfaces:**
- Produces: table `collections` (`@@unique([userId,name])`), `bookmarks.collectionId` (nullable, `onDelete: SetNull`), relations `User.collections`, `Collection.bookmarks`, `Bookmark.collection`.

- [ ] **Step 1: DB dev up**

Run: `docker compose up -d`
Expected: `moodly-db-1` Running.

- [ ] **Step 2: Éditer le schéma**

Ajouter le modèle :

```prisma
model Collection {
  id        String     @id @default(cuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  createdAt DateTime   @default(now())
  bookmarks Bookmark[]

  @@unique([userId, name])
  @@index([userId])
  @@map("collections")
}
```

Dans `model Bookmark`, ajouter :

```prisma
  collectionId String?
  collection   Collection? @relation(fields: [collectionId], references: [id], onDelete: SetNull)
```

Dans `model User`, ajouter la relation inverse :

```prisma
  collections   Collection[]
```

- [ ] **Step 3: Migration + client (Node 20)**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx dotenv -e .env -- prisma migrate dev --name add_collections`
Expected: migration créée + appliquée, client régénéré.

- [ ] **Step 4: Non-régression**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx tsc --noEmit && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npm test`
Expected: typecheck clean ; suite verte (105) — changement purement additif.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): schéma collections (Collection + Bookmark.collectionId)"
```

---

### Task 2: Collections — service + CRUD + liste avec couvertures

**Files:**
- Create: `apps/api/src/modules/collections/collections.service.ts`
- Create: `apps/api/src/modules/collections/collections.routes.ts`
- Modify: `apps/api/src/app.ts` (monter le routeur)
- Create: `apps/api/tests/collections.test.ts`

**Interfaces:**
- Consumes: `designInclude`/`toApiDesign` (Task 3 les utilise), `prisma`, `ApiError`.
- Produces routes (toutes `requireAuth`) :
  - `GET /collections` → `{ collections: [{ id, name, count, covers: string[] }] }`
  - `POST /collections` `{ name }` → `{ collection }` (409 doublon)
  - `PATCH /collections/:id` `{ name }` → `{ collection }` (404 / 409)
  - `DELETE /collections/:id` → 204

  (Montées sous `/me` : chemins finaux `/me/collections…`.)

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// apps/api/tests/collections.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();

describe('collections CRUD', () => {
  let token: string;
  beforeEach(async () => {
    const c = await registerUser(app, 'CLIENT', '+221770007001');
    token = c.token;
  });

  it('cree, liste, renomme, supprime une collection', async () => {
    const create = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Mariage' });
    expect(create.status).toBe(201);
    const id = create.body.collection.id;

    const list = await request(app).get('/me/collections').set('Authorization', `Bearer ${token}`);
    expect(list.body.collections).toHaveLength(1);
    expect(list.body.collections[0]).toMatchObject({ name: 'Mariage', count: 0 });
    expect(Array.isArray(list.body.collections[0].covers)).toBe(true);

    const rename = await request(app).patch(`/me/collections/${id}`).set('Authorization', `Bearer ${token}`).send({ name: 'Mariages' });
    expect(rename.body.collection.name).toBe('Mariages');

    const del = await request(app).delete(`/me/collections/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  it('refuse un nom duplique (409)', async () => {
    await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Boubous' });
    const dup = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Boubous' });
    expect(dup.status).toBe(409);
  });

  it('404 sur la collection d un autre client', async () => {
    const create = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Prive' });
    const other = await registerUser(app, 'CLIENT', '+221770007099');
    const res = await request(app).patch(`/me/collections/${create.body.collection.id}`).set('Authorization', `Bearer ${other.token}`).send({ name: 'Vole' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx dotenv -e .env.test -- prisma migrate deploy && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx vitest run tests/collections.test.ts`
Expected: FAIL — routes absentes.

- [ ] **Step 3: Service**

```typescript
// apps/api/src/modules/collections/collections.service.ts
import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export async function listCollections(userId: string) {
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { bookmarks: true } },
      bookmarks: {
        take: 4,
        orderBy: { createdAt: 'desc' },
        include: { design: { select: { imageUrl: true } } },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    count: c._count.bookmarks,
    covers: c.bookmarks.map((b) => b.design.imageUrl),
  }));
}

export async function createCollection(userId: string, name: string) {
  try {
    return await prisma.collection.create({ data: { userId, name } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'NOM_DEJA_UTILISE', 'Tu as déjà une collection avec ce nom.');
    }
    throw err;
  }
}

export async function getOwnedCollection(userId: string, id: string) {
  const c = await prisma.collection.findFirst({ where: { id, userId } });
  if (!c) throw new ApiError(404, 'INTROUVABLE', 'Collection introuvable.');
  return c;
}

export async function renameCollection(userId: string, id: string, name: string) {
  await getOwnedCollection(userId, id);
  try {
    return await prisma.collection.update({ where: { id }, data: { name } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'NOM_DEJA_UTILISE', 'Tu as déjà une collection avec ce nom.');
    }
    throw err;
  }
}

export async function deleteCollection(userId: string, id: string) {
  await getOwnedCollection(userId, id);
  await prisma.collection.delete({ where: { id } });
}
```

- [ ] **Step 4: Routes**

```typescript
// apps/api/src/modules/collections/collections.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  createCollection,
  deleteCollection,
  listCollections,
  renameCollection,
} from './collections.service.js';

export const collectionsRouter = Router();

const nameSchema = z.object({ name: z.string().trim().min(1, 'Donne un nom.').max(40) });

collectionsRouter.get('/', requireAuth, async (req, res) => {
  res.json({ collections: await listCollections(req.user!.sub) });
});

collectionsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  const collection = await createCollection(req.user!.sub, parsed.data.name);
  res.status(201).json({ collection });
});

collectionsRouter.patch('/:id', requireAuth, async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  const collection = await renameCollection(req.user!.sub, req.params.id as string, parsed.data.name);
  res.json({ collection });
});

collectionsRouter.delete('/:id', requireAuth, async (req, res) => {
  await deleteCollection(req.user!.sub, req.params.id as string);
  res.status(204).send();
});
```

Monter sous `/me/collections` dans `apps/api/src/app.ts` (près de `usersRouter`) :

```typescript
import { collectionsRouter } from './modules/collections/collections.routes.js';
// ... après app.use('/me', ... ) ou avec les autres :
app.use('/me/collections', collectionsRouter);
```

(Note : vérifier comment `usersRouter` est monté — `/me` routes sont sur `usersRouter` monté à `/` ou `/me`. Monter `collectionsRouter` de sorte que les chemins finaux soient `/me/collections…`. Si `usersRouter` est monté à la racine avec des chemins `/me/...`, alors monter `app.use('/me/collections', collectionsRouter)`.)

- [ ] **Step 5: Vert + non-régression**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx vitest run tests/collections.test.ts && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx tsc --noEmit && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npm test`
Expected: nouveaux tests verts ; typecheck clean ; suite verte.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/collections apps/api/src/app.ts apps/api/tests/collections.test.ts
git commit -m "feat(api): CRUD collections (liste avec couvertures)"
```

---

### Task 3: Détail collection + ranger un enregistrement

**Files:**
- Modify: `apps/api/src/modules/collections/collections.service.ts`
- Modify: `apps/api/src/modules/collections/collections.routes.ts`
- Modify: `apps/api/src/modules/users/users.routes.ts` (PATCH /me/bookmarks/:designId)
- Modify: `apps/api/tests/collections.test.ts`

**Interfaces:**
- Produces:
  - `GET /me/collections/:id` → `{ collection: { id, name }, designs: ApiDesign[] }`
  - `PATCH /me/bookmarks/:designId` `{ collectionId: string | null }` → 204 (upsert bookmark + range ; incrémente `bookmarksCount` si nouveau).

- [ ] **Step 1: Ajouter les tests (échec attendu)**

Ajouter dans `apps/api/tests/collections.test.ts` un bloc :

```typescript
import { prisma } from '../src/lib/prisma.js';

describe('ranger et detail', () => {
  let token: string;
  let userId: string;
  let designId: string;
  beforeEach(async () => {
    const c = await registerUser(app, 'CLIENT', '+221770007010');
    token = c.token;
    userId = c.user.id;
    const t = await registerUser(app, 'TAILLEUR', '+221770007011');
    const d = await prisma.design.create({
      data: { tailorId: t.user.id, title: 'Robe', category: 'ROBE', imageUrl: '/uploads/r.webp', imageWidth: 600, imageHeight: 800 },
    });
    designId = d.id;
  });

  it('range un modele dans une collection puis le detail le renvoie', async () => {
    const col = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Envies' });
    const id = col.body.collection.id;

    const move = await request(app).patch(`/me/bookmarks/${designId}`).set('Authorization', `Bearer ${token}`).send({ collectionId: id });
    expect(move.status).toBe(204);

    const detail = await request(app).get(`/me/collections/${id}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.collection.name).toBe('Envies');
    expect(detail.body.designs.map((d: { id: string }) => d.id)).toContain(designId);

    // et le compteur de bookmark du design est incremente
    const design = await prisma.design.findUnique({ where: { id: designId } });
    expect(design!.bookmarksCount).toBe(1);
  });

  it('supprimer la collection remet le bookmark non classe (pas de perte)', async () => {
    const col = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'X' });
    await request(app).patch(`/me/bookmarks/${designId}`).set('Authorization', `Bearer ${token}`).send({ collectionId: col.body.collection.id });
    await request(app).delete(`/me/collections/${col.body.collection.id}`).set('Authorization', `Bearer ${token}`);
    const all = await request(app).get('/me/bookmarks').set('Authorization', `Bearer ${token}`);
    expect(all.body.designs.map((d: { id: string }) => d.id)).toContain(designId);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx vitest run tests/collections.test.ts`
Expected: FAIL sur les deux nouveaux tests.

- [ ] **Step 3: Service détail**

Ajouter à `collections.service.ts` (importer `designInclude`/`toApiDesign`) :

```typescript
import { designInclude, toApiDesign } from '../designs/designs.service.js';

export async function getCollectionDesigns(userId: string, id: string) {
  const collection = await getOwnedCollection(userId, id);
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId, collectionId: id },
    orderBy: { createdAt: 'desc' },
    include: { design: { include: designInclude(userId) } },
  });
  return { collection: { id: collection.id, name: collection.name }, designs: bookmarks.map((b) => toApiDesign(b.design)) };
}
```

Route dans `collections.routes.ts` :

```typescript
import { getCollectionDesigns } from './collections.service.js';

collectionsRouter.get('/:id', requireAuth, async (req, res) => {
  res.json(await getCollectionDesigns(req.user!.sub, req.params.id as string));
});
```

- [ ] **Step 4: PATCH /me/bookmarks/:designId (users.routes.ts)**

Dans `apps/api/src/modules/users/users.routes.ts` (importer `ensureDesignExists` depuis `../designs/designs.service.js`, et `z`) :

```typescript
usersRouter.patch('/me/bookmarks/:designId', requireAuth, async (req, res) => {
  const parsed = z.object({ collectionId: z.string().nullable() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', 'Collection invalide.');
  const userId = req.user!.sub;
  const designId = req.params.designId as string;
  await ensureDesignExists(designId);
  if (parsed.data.collectionId) {
    const col = await prisma.collection.findFirst({ where: { id: parsed.data.collectionId, userId } });
    if (!col) throw new ApiError(404, 'INTROUVABLE', 'Collection introuvable.');
  }
  const existing = await prisma.bookmark.findUnique({ where: { userId_designId: { userId, designId } } });
  if (existing) {
    await prisma.bookmark.update({ where: { id: existing.id }, data: { collectionId: parsed.data.collectionId } });
  } else {
    await prisma.$transaction([
      prisma.bookmark.create({ data: { userId, designId, collectionId: parsed.data.collectionId } }),
      prisma.design.update({ where: { id: designId }, data: { bookmarksCount: { increment: 1 } } }),
    ]);
  }
  res.status(204).send();
});
```

(`ensureDesignExists` est déjà exporté par `designs.service.ts`.)

- [ ] **Step 5: Vert + non-régression**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx vitest run tests/collections.test.ts && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx tsc --noEmit && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npm test`
Expected: tout vert.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/collections apps/api/src/modules/users/users.routes.ts apps/api/tests/collections.test.ts
git commit -m "feat(api): détail collection + ranger un enregistrement (PATCH /me/bookmarks/:id)"
```

---

### Task 4: Mobile — types + hooks collections

**Files:**
- Modify: `apps/mobile/src/types.ts`
- Create: `apps/mobile/src/collections/hooks.ts`

**Interfaces:**
- Produces:
  - `type CollectionSummary = { id: string; name: string; count: number; covers: string[] }`
  - `useCollections()` → `{ collections, isLoading, isError, refetch }`
  - `useCollection(id)` → `{ collection, designs, isLoading, isError, refetch }`
  - `useCreateCollection()` → `{ create(name): Promise<CollectionSummary-ish>, creating }`
  - `useRenameCollection()` / `useDeleteCollection()` / `useMoveBookmark()`.

- [ ] **Step 1: Types**

Dans `apps/mobile/src/types.ts` :

```typescript
export type CollectionSummary = { id: string; name: string; count: number; covers: string[] };
```

- [ ] **Step 2: Hooks**

```typescript
// apps/mobile/src/collections/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { CollectionSummary, Design } from '../types';

export function useCollections() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['collections'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ collections: CollectionSummary[] }>('/me/collections', { token }),
  });
  return { collections: q.data?.collections ?? [], isLoading: q.isLoading, isError: q.isError, refetch: () => q.refetch() };
}

export function useCollection(id: string) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['collection', id],
    enabled: Boolean(token && id),
    queryFn: () => apiFetch<{ collection: { id: string; name: string }; designs: Design[] }>(`/me/collections/${id}`, { token }),
  });
  return { collection: q.data?.collection ?? null, designs: q.data?.designs ?? [], isLoading: q.isLoading, isError: q.isError, refetch: () => q.refetch() };
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['collections'] });
    qc.invalidateQueries({ queryKey: ['bookmarks'] });
  };
}

export function useCreateCollection() {
  const { token } = useAuth();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: (name: string) => apiFetch<{ collection: CollectionSummary }>('/me/collections', { method: 'POST', body: { name }, token }),
    onSuccess: invalidate,
  });
  return { create: (name: string) => m.mutateAsync(name), creating: m.isPending };
}

export function useRenameCollection() {
  const { token } = useAuth();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiFetch(`/me/collections/${id}`, { method: 'PATCH', body: { name }, token }),
    onSuccess: invalidate,
  });
  return { rename: (id: string, name: string) => m.mutateAsync({ id, name }), renaming: m.isPending };
}

export function useDeleteCollection() {
  const { token } = useAuth();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: (id: string) => apiFetch(`/me/collections/${id}`, { method: 'DELETE', token }),
    onSuccess: invalidate,
  });
  return { remove: (id: string) => m.mutateAsync(id), removing: m.isPending };
}

export function useMoveBookmark() {
  const { token } = useAuth();
  const invalidate = useInvalidate();
  const m = useMutation({
    mutationFn: ({ designId, collectionId }: { designId: string; collectionId: string | null }) =>
      apiFetch(`/me/bookmarks/${designId}`, { method: 'PATCH', body: { collectionId }, token }),
    onSuccess: invalidate,
  });
  return { move: (designId: string, collectionId: string | null) => m.mutateAsync({ designId, collectionId }), moving: m.isPending };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: clean.

```bash
git add apps/mobile/src/types.ts apps/mobile/src/collections/hooks.ts
git commit -m "feat(mobile): types + hooks collections"
```

---

### Task 5: Mobile — `mosaicSlots` + `MosaicCover` + `CollectionCard`

**Files:**
- Create: `apps/mobile/src/collections/mosaic.ts`
- Create: `apps/mobile/src/collections/mosaic.test.ts`
- Create: `apps/mobile/src/collections/CollectionCard.tsx`
- Create: `apps/mobile/src/collections/CollectionCard.test.tsx`

**Interfaces:**
- Produces:
  - `mosaicSlots(urls: string[]): string[]` — normalise à **1, 2, 3 ou 4** tuiles (tronque au-delà ; renvoie `[]` si vide).
  - `MosaicCover({ covers }: { covers: string[] })` — rend la couverture (1 grande / 2 / 3 / 4 tuiles) avec `imageUri`, coins arrondis.
  - `CollectionCard({ name, count, covers, onPress })` — carte board : `MosaicCover` + nom + count. testID `collection-card`.

- [ ] **Step 1: Test `mosaicSlots` (échec attendu)**

```typescript
// apps/mobile/src/collections/mosaic.test.ts
import { mosaicSlots } from './mosaic';

describe('mosaicSlots', () => {
  it('tronque a 4', () => {
    expect(mosaicSlots(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd']);
  });
  it('garde 1 a 3 tel quel', () => {
    expect(mosaicSlots(['a'])).toEqual(['a']);
    expect(mosaicSlots(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
  it('vide -> []', () => {
    expect(mosaicSlots([])).toEqual([]);
  });
});
```

Run: `cd apps/mobile && npx jest src/collections/mosaic.test.ts` → FAIL.

- [ ] **Step 2: Implémenter `mosaic.ts`**

```typescript
// apps/mobile/src/collections/mosaic.ts
export function mosaicSlots(urls: string[]): string[] {
  return urls.slice(0, 4);
}
```

Run: `cd apps/mobile && npx jest src/collections/mosaic.test.ts` → PASS.

- [ ] **Step 3: `MosaicCover` + `CollectionCard` + test**

```tsx
// apps/mobile/src/collections/CollectionCard.tsx
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUri } from '../lib/config';
import { colors, fonts, radius, spacing } from '../theme';
import { mosaicSlots } from './mosaic';

export function MosaicCover({ covers }: { covers: string[] }) {
  const slots = mosaicSlots(covers);
  if (slots.length === 0) {
    return <View style={[styles.cover, styles.coverEmpty]} />;
  }
  if (slots.length === 1) {
    return <Image source={{ uri: imageUri(slots[0]) }} style={styles.cover} contentFit="cover" />;
  }
  return (
    <View style={[styles.cover, styles.mosaic]}>
      {slots.map((u, i) => (
        <Image key={i} source={{ uri: imageUri(u) }} style={styles.tile} contentFit="cover" />
      ))}
    </View>
  );
}

export function CollectionCard({
  name,
  count,
  covers,
  onPress,
}: {
  name: string;
  count: number;
  covers: string[];
  onPress: () => void;
}) {
  return (
    <Pressable testID="collection-card" style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <MosaicCover covers={covers} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  );
}

const GAP = 2;
const styles = StyleSheet.create({
  card: { flex: 1, marginBottom: spacing.lg },
  pressed: { opacity: 0.92 },
  cover: { width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.inkElevated },
  coverEmpty: { backgroundColor: colors.inkElevated },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: `${50}%`, height: `${50}%`, backgroundColor: colors.ink, flexGrow: 1, flexBasis: '48%' },
  name: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15, marginTop: spacing.sm },
  count: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
```

```tsx
// apps/mobile/src/collections/CollectionCard.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CollectionCard } from './CollectionCard';

describe('CollectionCard', () => {
  it('affiche nom et count, declenche onPress', () => {
    const onPress = jest.fn();
    render(<CollectionCard name="Mariage" count={12} covers={['/uploads/a.webp']} onPress={onPress} />);
    expect(screen.getByText('Mariage')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    fireEvent.press(screen.getByTestId('collection-card'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

Run: `cd apps/mobile && npx jest src/collections/` → PASS (mosaic + card).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/collections/mosaic.ts apps/mobile/src/collections/mosaic.test.ts apps/mobile/src/collections/CollectionCard.tsx apps/mobile/src/collections/CollectionCard.test.tsx
git commit -m "feat(mobile): carte-collection (mosaïque) + helper mosaicSlots"
```

---

### Task 6: Mobile — onglet Enregistrés (boards) + détail collection

**Files:**
- Modify: `apps/mobile/app/(tabs)/saved.tsx` (refonte : grille de boards)
- Create: `apps/mobile/app/collection/[id].tsx` (détail)
- Create: `apps/mobile/app/saved-all.tsx` (vue « Tous les enregistrés », masonry des bookmarks)

**Interfaces:**
- Consumes: `useCollections`, `useCollection`, `useBookmarks`, `CollectionCard`, `useRenameCollection`, `useDeleteCollection`, `useCreateCollection`.

- [ ] **Step 1: Refonte `saved.tsx`**

Remplacer le corps par : `AppHeader` + en-tête « Enregistrés » avec un bouton « + Nouvelle collection » (ouvre un `Modal` de saisie → `useCreateCollection().create(name)`), puis une **grille 2 colonnes** :
- 1re carte « Tous les enregistrés » (`CollectionCard` avec `name="Tous"`, `count = bookmarks.length`, `covers = premières imageUrl des bookmarks`) → `router.push('/saved-all')`.
- une `CollectionCard` par `collections` → `router.push(\`/collection/${c.id}\`)`.
- État vide (aucune collection ET aucun bookmark) : invite à enregistrer/créer.

Disposition 2 colonnes : `View` `flexDirection:'row'` `flexWrap:'wrap'` `gap: spacing.md`, chaque carte dans un wrapper `width: '48%'`. (Réutiliser `colors/fonts/spacing`, pas de `fontWeight`.)

- [ ] **Step 2: `saved-all.tsx`**

Écran simple : header retour + « Tous les enregistrés » + `MasonryColumns` des `useBookmarks().designs` (tap → `/design/:id`). Réutilise le style sombre.

- [ ] **Step 3: `collection/[id].tsx`**

Header : retour + nom (`useCollection(id).collection?.name`) + bouton «…» ouvrant un `Modal` d'actions : **Renommer** (saisie → `useRenameCollection().rename(id, name)`) et **Supprimer** (confirmation → `useDeleteCollection().remove(id)` puis `router.back()`). Corps : `MasonryColumns` des `designs` ; état vide « Range des modèles ici depuis tes enregistrés. ».

- [ ] **Step 4: Typecheck + suite**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: clean + verte (les écrans-route ne cassent pas les tests existants).

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(tabs)/saved.tsx" apps/mobile/app/collection apps/mobile/app/saved-all.tsx
git commit -m "feat(mobile): Enregistrés en boards + détail collection + vue Tous"
```

---

### Task 7: Mobile — `CollectionPickerSheet` (ranger dans…) + branchement

**Files:**
- Create: `apps/mobile/src/collections/CollectionPickerSheet.tsx`
- Create: `apps/mobile/src/collections/CollectionPickerSheet.test.tsx`
- Modify: `apps/mobile/app/saved-all.tsx` (appui long / bouton «…» sur une tuile → ouvre le sheet)

**Interfaces:**
- Produces: `CollectionPickerSheet({ visible, onClose, collections, onPick, onCreate })` — bottom sheet (patron `CommentsSheet`) listant les collections (nom + count) + une entrée « + Nouvelle collection » (saisie inline). `onPick(collectionId | null)` range ; `onCreate(name)` crée. testIDs : `picker-backdrop`, une entrée par collection (`picker-<id>`), `picker-new`.

- [ ] **Step 1: Test (échec attendu)**

```tsx
// apps/mobile/src/collections/CollectionPickerSheet.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CollectionPickerSheet } from './CollectionPickerSheet';

const collections = [
  { id: 'c1', name: 'Mariage', count: 2, covers: [] },
  { id: 'c2', name: 'Boubous', count: 5, covers: [] },
];

describe('CollectionPickerSheet', () => {
  it('liste les collections et range au choix', () => {
    const onPick = jest.fn();
    render(<CollectionPickerSheet visible collections={collections} onClose={jest.fn()} onPick={onPick} onCreate={jest.fn()} />);
    expect(screen.getByText('Mariage')).toBeTruthy();
    fireEvent.press(screen.getByTestId('picker-c2'));
    expect(onPick).toHaveBeenCalledWith('c2');
  });

  it('ferme via le backdrop', () => {
    const onClose = jest.fn();
    render(<CollectionPickerSheet visible collections={collections} onClose={onClose} onPick={jest.fn()} onCreate={jest.fn()} />);
    fireEvent.press(screen.getByTestId('picker-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

Run: `cd apps/mobile && npx jest src/collections/CollectionPickerSheet.test.tsx` → FAIL.

- [ ] **Step 2: Implémenter `CollectionPickerSheet`**

Patron `CommentsSheet` (Modal transparent slide, backdrop `picker-backdrop`, poignée, titre « Ranger dans… »). Liste `collections.map` en `Pressable testID={\`picker-${c.id}\`}` (nom + count). En tête ou pied : une ligne `testID="picker-new"` qui bascule une saisie inline (`TextInput` + valider → `onCreate(name)`). Tokens de thème only, ASCII prudent si des sous-fichiers `.ts` sont impliqués (ici `.tsx`, ok). `onPick(c.id)` sur chaque entrée ; option « Retirer de la collection » → `onPick(null)`.

Run: `cd apps/mobile && npx jest src/collections/CollectionPickerSheet.test.tsx` → PASS (2).

- [ ] **Step 3: Brancher dans `saved-all.tsx`**

Envelopper chaque tuile (ou ajouter un bouton «…») pour ouvrir le sheet avec le `designId` courant ; `onPick={(cid) => move(designId, cid)}` (`useMoveBookmark`), `onCreate={(name) => create(name).then(c => move(designId, c.collection.id))}` (`useCreateCollection`). Fermer après action. (Appui long sur la tuile = ouverture ; garder simple.)

- [ ] **Step 4: Typecheck + suite complète**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: clean + verte.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/collections/CollectionPickerSheet.tsx apps/mobile/src/collections/CollectionPickerSheet.test.tsx apps/mobile/app/saved-all.tsx
git commit -m "feat(mobile): sheet Ranger dans une collection"
```

---

### Task 8: Vérification finale

- [ ] **Step 1: Suites + typecheck**

Run (Node 20 pour l'API) :
`cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx tsc --noEmit && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npm test`
`cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: API verte (105 + collections) ; mobile verte (65 + mosaic/card/sheet).

- [ ] **Step 2: Bundle (Node 20)**

Run: `cd apps/mobile && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx expo export --platform ios --output-dir /tmp/moodly-m1` ; vérifier le `.hbc` ; `rm -rf /tmp/moodly-m1`.

- [ ] **Step 3: Revue manuelle (Expo Go, Node 20)**

Client : onglet **Enregistrés** = boards (Tous + collections avec mosaïque) ; **+ Nouvelle collection** ; enregistrer un modèle puis, depuis « Tous », **appui long → Ranger dans…** ; ouvrir une collection ; **Renommer / Supprimer** ; vérifier qu'après suppression le modèle reste dans « Tous ».

---

## Notes d'implémentation

- **Compteur `bookmarksCount`** : `PATCH /me/bookmarks/:id` n'incrémente que lors d'une **première** sauvegarde (upsert) — sinon simple déplacement. Cohérent avec `addReaction`/`removeReaction`.
- **`GET /me/collections`** ne renvoie pas la vue « Tous » ; le mobile la construit depuis `useBookmarks` (count + premières couvertures).
- **Mosaïque** : `mosaicSlots` borne à 4 ; `MosaicCover` gère 1 (grande) / 2–4 (tuiles). Design sobre, coins arrondis, `imageUri` partout.
- **Sheet** : même patron que `CommentsSheet` (cohérence des micro-interactions « qui glissent »).
- Écrans-route (saved, collection, saved-all) non testés en unité (comme les autres routes) ; couverts par les composants testés + la revue manuelle.
