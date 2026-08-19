# M8 — Attribution des créations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chaque publication un statut d'attribution (`INSPIRATION` / `ORIGINAL`), incruster un filigrane serveur sur les créations originales, et refondre l'écran de publication en assistant pas-à-pas.

**Architecture:** Un enum Prisma `PostType` + deux champs sur `Design`. Le statut voyage dans le multipart `POST /designs` ; côté serveur, une création `ORIGINAL` déclenche un filigrane texte incrusté par `sharp` dans le pipeline de stockage (avant webp + blurhash), tandis que `sourceCredit` est vidé. Côté mobile, la route `app/publish.tsx` devient un ré-export d'un composant `PublishWizard` à état d'étape (calqué sur `SignupWizard`), et l'attribution s'affiche via un badge sur le détail et la carte.

**Tech Stack:** TypeScript, Prisma/PostgreSQL, Express, Zod, `sharp`, Vitest (API) ; React Native / expo-router, React Query, Jest + `@testing-library/react-native` (mobile) ; monorepo npm workspaces avec `@moodly/shared`.

**Spec:** `docs/superpowers/specs/2026-08-15-mvp1-m8-attribution-design.md`

## Global Constraints

- **Défaut = `INSPIRATION`** partout (data, zod, UI). Les lignes existantes prennent ce défaut.
- **Statut figé à la publication** : aucune route d'édition du statut n'est ajoutée.
- **Cohérence serveur** : si `postType === 'ORIGINAL'`, `sourceCredit` est forcé à `null` (jamais persisté).
- **Filigrane uniquement sur `ORIGINAL`** : `INSPIRATION` ⇒ pipeline de stockage strictement inchangé (aucun filigrane).
- **Photos seulement** ; l'étape Média accepte `mediaTypes: ['images']`.
- **Label du filigrane** : exactement `© {nom de l'atelier} · Modly` (caractères `©` et `·` inclus).
- **Réutiliser les constantes partagées** : le statut est défini une seule fois dans `@moodly/shared` (`POST_TYPES` / `PostType`) et importé par l'API (zod) et le mobile (types + UI).
- **Textes en français** (copie produit), cohérents avec la spec (« Création originale », « Inspiration », « Source »).
- Commits fréquents, un par tâche, en français, préfixe conventionnel (`feat`, `test`…). Terminer chaque message par :
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: Constante partagée `PostType`

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/index.test.ts`

**Interfaces:**
- Produces: `export const POST_TYPES = ['INSPIRATION', 'ORIGINAL'] as const;` et `export type PostType = (typeof POST_TYPES)[number];`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `packages/shared/src/index.test.ts` :

```ts
import { POST_TYPES } from './index';

describe('POST_TYPES', () => {
  it('contient les deux statuts, INSPIRATION en premier (défaut)', () => {
    expect(POST_TYPES).toEqual(['INSPIRATION', 'ORIGINAL']);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -w @moodly/shared`
Expected: FAIL — `POST_TYPES` n'existe pas (import undefined).

- [ ] **Step 3: Implémenter**

Ajouter dans `packages/shared/src/index.ts`, juste après le bloc `DESIGN_CATEGORIES` / `DesignCategory` :

```ts
export const POST_TYPES = ['INSPIRATION', 'ORIGINAL'] as const;
export type PostType = (typeof POST_TYPES)[number];
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -w @moodly/shared`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "feat(shared): POST_TYPES (INSPIRATION/ORIGINAL) pour l'attribution M8"
```

---

### Task 2: Schéma Prisma + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_m8_attribution/migration.sql` (généré par Prisma)

**Interfaces:**
- Produces: `Design.postType: PostType @default(INSPIRATION)` et `Design.sourceCredit: String?` ; enum Prisma `PostType { INSPIRATION ORIGINAL }`.

- [ ] **Step 1: Ajouter l'enum**

Dans `apps/api/prisma/schema.prisma`, juste avant `model Design {` (à côté des autres enums) :

```prisma
enum PostType {
  INSPIRATION
  ORIGINAL
}
```

- [ ] **Step 2: Ajouter les champs au modèle `Design`**

Dans `model Design { … }`, ajouter ces deux lignes juste après `category      DesignCategory` :

```prisma
  postType       PostType       @default(INSPIRATION)
  sourceCredit   String?
```

- [ ] **Step 3: Générer la migration (crée aussi le SQL et régénère le client)**

Run: `cd apps/api && npx prisma migrate dev --name m8_attribution`
Expected: nouvelle migration créée sous `prisma/migrations/`, client Prisma régénéré, aucune erreur. Le SQL ajoute la colonne `postType` avec défaut `'INSPIRATION'` (les ~62 lignes existantes héritent du défaut) et `sourceCredit` nullable.

- [ ] **Step 4: Vérifier que le typecheck API passe (client régénéré)**

Run: `npm run typecheck -w @moodly/api`
Expected: PASS (aucune régression ; `PostType` disponible via `@prisma/client`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): schema + migration attribution (postType/sourceCredit sur Design) (M8)"
```

---

### Task 3: Helper de filigrane serveur

**Files:**
- Create: `apps/api/src/lib/watermark.ts`
- Test: `apps/api/tests/watermark.test.ts`

**Interfaces:**
- Produces: `export async function watermarkBuffer(buffer: Buffer, label: string): Promise<Buffer>` — renvoie un buffer PNG de mêmes dimensions que l'entrée, avec le `label` incrusté en bas-droite ; si les dimensions sont illisibles, renvoie le buffer d'origine inchangé.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/api/tests/watermark.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { watermarkBuffer } from '../src/lib/watermark.js';
import { makeTestImage } from './helpers.js';

describe('watermarkBuffer', () => {
  it('incruste un filigrane et conserve les dimensions', async () => {
    const src = await makeTestImage(600, 800);
    const out = await watermarkBuffer(src, '© Atelier Awa · Modly');
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(800);
    // Le rendu diffère de l'original (des pixels ont été modifiés).
    expect(out.equals(src)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -w @moodly/api -- watermark`
Expected: FAIL — module `../src/lib/watermark.js` introuvable.

- [ ] **Step 3: Implémenter le helper**

Créer `apps/api/src/lib/watermark.ts` :

```ts
import sharp from 'sharp';

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

/**
 * Incruste un filigrane texte discret en bas-droite (p.ex. « © Atelier Awa · Modly »).
 * Taille de police proportionnelle à la largeur, opacité faible, léger contour noir
 * pour rester lisible sur fond clair comme foncé. Renvoie un PNG composé.
 */
export async function watermarkBuffer(buffer: Buffer, label: string): Promise<Buffer> {
  const image = sharp(buffer);
  const { width, height } = await image.metadata();
  if (!width || !height) return buffer;
  const fontSize = Math.max(12, Math.round(width * 0.035));
  const pad = Math.round(fontSize * 0.8);
  const strokeWidth = Math.max(1, Math.round(fontSize / 18));
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width - pad}" y="${height - pad}" text-anchor="end"
    font-family="sans-serif" font-size="${fontSize}"
    fill="#ffffff" fill-opacity="0.55"
    stroke="#000000" stroke-opacity="0.25" stroke-width="${strokeWidth}"
    paint-order="stroke">${escapeXml(label)}</text>
</svg>`;
  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -w @moodly/api -- watermark`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/watermark.ts apps/api/tests/watermark.test.ts
git commit -m "feat(api): helper watermarkBuffer (filigrane serveur © atelier · Modly) (M8)"
```

---

### Task 4: `storage.save` accepte une option de filigrane

**Files:**
- Modify: `apps/api/src/lib/storage.ts`
- Test: `apps/api/tests/storage.test.ts`

**Interfaces:**
- Consumes: `watermarkBuffer(buffer, label)` (Task 3).
- Produces: signature élargie `save(buffer: Buffer, opts?: { watermark?: string }): Promise<StoredImage>`. Quand `opts.watermark` est fourni, l'image filigranée sert de source **à la fois** au webp stocké et au blurhash. Sans option, comportement strictement inchangé.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `apps/api/tests/storage.test.ts` un cas dans le `describe` existant :

```ts
  it('applique un filigrane quand demandé, sans casser url/dimensions', async () => {
    const buffer = await makeTestImage(600, 800);
    const stored = await storage.save(buffer, { watermark: '© Atelier Awa · Modly' });
    expect(stored.width).toBe(600);
    expect(stored.height).toBe(800);
    expect(stored.url).toMatch(/\/uploads\/[\w-]+\.webp$/);
    expect(stored.blurhash).toEqual(expect.any(String));
  });
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -w @moodly/api -- storage`
Expected: FAIL — TypeScript refuse le 2e argument (`Expected 1 arguments, but got 2`) ou le test ne compile pas.

- [ ] **Step 3: Implémenter**

Dans `apps/api/src/lib/storage.ts` :

Ajouter l'import en tête :

```ts
import { watermarkBuffer } from './watermark.js';
```

Élargir l'interface :

```ts
export interface ImageStorage {
  save(buffer: Buffer, opts?: { watermark?: string }): Promise<StoredImage>;
}
```

Remplacer `LocalDiskStorage.save` par :

```ts
  async save(buffer: Buffer, opts?: { watermark?: string }): Promise<StoredImage> {
    const source = opts?.watermark ? await watermarkBuffer(buffer, opts.watermark) : buffer;
    let width: number | undefined;
    let height: number | undefined;
    let webp: Buffer;
    try {
      const image = sharp(source);
      ({ width, height } = await image.metadata());
      webp = await image.webp({ quality: 82 }).toBuffer();
    } catch {
      throw new ApiError(400, 'IMAGE_INVALIDE', 'Impossible de lire cette image.');
    }
    if (!width || !height) {
      throw new ApiError(400, 'IMAGE_INVALIDE', 'Impossible de lire cette image.');
    }
    const fileName = `${randomUUID()}.webp`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, fileName), webp);
    const blurhash = await computeBlurhash(source);
    // Chemin relatif : l'app le préfixe avec l'URL de l'API qu'elle détecte.
    // Ainsi les images ne cassent pas quand l'IP LAN change.
    return { url: `/uploads/${fileName}`, width, height, blurhash };
  }
```

Remplacer `CloudinaryStorage.save` par (filigrane appliqué avant blurhash **et** upload) :

```ts
  async save(buffer: Buffer, opts?: { watermark?: string }): Promise<StoredImage> {
    const source = opts?.watermark ? await watermarkBuffer(buffer, opts.watermark) : buffer;
    const blurhash = await computeBlurhash(source);
    const result = await new Promise<{ secure_url: string; width: number; height: number }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: 'moodly/designs' }, (err, res) => {
            if (err || !res) reject(err ?? new Error('Réponse Cloudinary vide'));
            else resolve(res);
          })
          .end(source);
      },
    );
    return { url: result.secure_url, width: result.width, height: result.height, blurhash };
  }
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npm test -w @moodly/api -- storage`
Expected: PASS (les deux cas : avec et sans filigrane).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/storage.ts apps/api/tests/storage.test.ts
git commit -m "feat(api): storage.save applique un filigrane optionnel (M8)"
```

---

### Task 5: `POST /designs` — statut, cohérence et déclenchement du filigrane

**Files:**
- Modify: `apps/api/src/modules/designs/designs.routes.ts:31-35` (schéma zod) et le handler `POST '/'` (`:134-186`)
- Test: `apps/api/tests/attribution.test.ts` (créer)

**Interfaces:**
- Consumes: `POST_TYPES` (Task 1), champs `postType`/`sourceCredit` du modèle (Task 2), `storage.save(buffer, { watermark })` (Task 4).
- Produces: à la création, persistance de `postType` et `sourceCredit` ; pour `ORIGINAL`, `sourceCredit = null` et chaque image passée à `storage.save` avec `{ watermark: "© {nom atelier} · Modly" }`. `toApiDesign` remonte déjà les deux champs via `...rest` (aucune modif de sérialisation).

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `apps/api/tests/attribution.test.ts` :

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { storage } from '../src/lib/storage.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

afterEach(() => vi.restoreAllMocks());

describe('attribution des créations (M8)', () => {
  it('ORIGINAL : sourceCredit vidé même si envoyé, filigrane appliqué à chaque image', async () => {
    const saveSpy = vi.spyOn(storage, 'save');
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100001');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Ma création')
      .field('category', 'ROBE')
      .field('postType', 'ORIGINAL')
      .field('sourceCredit', 'ignore-moi')
      .attach('media', await makeTestImage(600, 800), 'a.jpg')
      .attach('media', await makeTestImage(600, 800), 'b.jpg');
    expect(res.status).toBe(201);
    expect(res.body.design.postType).toBe('ORIGINAL');
    expect(res.body.design.sourceCredit).toBeNull();
    // Un filigrane est demandé pour chacune des 2 images.
    expect(saveSpy).toHaveBeenCalledTimes(2);
    for (const call of saveSpy.mock.calls) {
      expect(call[1]).toMatchObject({ watermark: expect.stringContaining('· Modly') });
    }
  });

  it('INSPIRATION : sourceCredit persisté, aucun filigrane', async () => {
    const saveSpy = vi.spyOn(storage, 'save');
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100002');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Inspiration Pinterest')
      .field('category', 'ROBE')
      .field('postType', 'INSPIRATION')
      .field('sourceCredit', 'Pinterest / @awa')
      .attach('media', await makeTestImage(600, 800), 'a.jpg');
    expect(res.status).toBe(201);
    expect(res.body.design.postType).toBe('INSPIRATION');
    expect(res.body.design.sourceCredit).toBe('Pinterest / @awa');
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][1]).toBeUndefined();
  });

  it('sans champ : défaut INSPIRATION, sourceCredit null', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100003');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Par défaut')
      .field('category', 'ROBE')
      .attach('media', await makeTestImage(600, 800), 'a.jpg');
    expect(res.status).toBe(201);
    expect(res.body.design.postType).toBe('INSPIRATION');
    expect(res.body.design.sourceCredit).toBeNull();
  });

  it('feed et détail exposent postType et sourceCredit', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100004');
    const created = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Exposée')
      .field('category', 'ROBE')
      .field('postType', 'INSPIRATION')
      .field('sourceCredit', 'Source X')
      .attach('media', await makeTestImage(600, 800), 'a.jpg');
    const id = created.body.design.id as string;

    const detail = await request(app).get(`/designs/${id}`);
    expect(detail.body.design.postType).toBe('INSPIRATION');
    expect(detail.body.design.sourceCredit).toBe('Source X');

    const feed = await request(app).get('/designs');
    const found = feed.body.designs.find((d: { id: string }) => d.id === id);
    expect(found.postType).toBe('INSPIRATION');
    expect(found.sourceCredit).toBe('Source X');
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npm test -w @moodly/api -- attribution`
Expected: FAIL — `postType`/`sourceCredit` absents de la réponse (undefined), filigrane jamais demandé.

- [ ] **Step 3: Étendre le schéma zod**

Dans `apps/api/src/modules/designs/designs.routes.ts`, ajouter `POST_TYPES` à l'import `@moodly/shared` (ligne 4) :

```ts
import { DESIGN_CATEGORIES, POST_TYPES } from '@moodly/shared';
```

Remplacer `createDesignSchema` par :

```ts
const createDesignSchema = z.object({
  title: z.string().min(1, 'Le titre est requis.').max(120),
  description: z.string().max(1000).optional(),
  category: z.enum(DESIGN_CATEGORIES),
  postType: z.enum(POST_TYPES).default('INSPIRATION'),
  sourceCredit: z.string().max(200).optional(),
});
```

- [ ] **Step 4: Appliquer cohérence + filigrane + persistance dans le handler**

Dans le handler `designsRouter.post('/', …)`, juste après le bloc de validation des fichiers (après la boucle `for (const f of files)` qui vérifie les mimes, avant `const stored = …`), insérer :

```ts
    const isOriginal = parsed.data.postType === 'ORIGINAL';
    // Cohérence : une création originale n'a pas de source externe.
    const sourceCredit = isOriginal ? null : (parsed.data.sourceCredit ?? null);

    let watermark: string | undefined;
    if (isOriginal) {
      const tailor = await prisma.user.findUnique({
        where: { id: req.user!.sub },
        select: { name: true },
      });
      watermark = `© ${tailor?.name ?? 'Modly'} · Modly`;
    }
```

Remplacer la ligne `const stored = await Promise.all(files.map((f) => storage.save(f.buffer)));` par :

```ts
    const stored = await Promise.all(
      files.map((f) => storage.save(f.buffer, watermark ? { watermark } : undefined)),
    );
```

Dans l'objet `data` du `prisma.design.create`, ajouter ces deux champs (p.ex. juste après `category: parsed.data.category,`) :

```ts
        postType: parsed.data.postType,
        sourceCredit,
```

- [ ] **Step 5: Lancer les tests, vérifier qu'ils passent**

Run: `npm test -w @moodly/api -- attribution`
Expected: PASS (4 cas).

- [ ] **Step 6: Non-régression API**

Run: `npm test -w @moodly/api`
Expected: PASS (tous les tests, dont `media-upload`, `storage`, `feed`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/designs/designs.routes.ts apps/api/tests/attribution.test.ts
git commit -m "feat(api): POST /designs gère postType/sourceCredit + filigrane sur ORIGINAL (M8)"
```

---

### Task 6: Types mobile + multipart + builders de test

**Files:**
- Modify: `apps/mobile/src/types.ts:30-48` (type `Design`)
- Modify: `apps/mobile/src/designs/buildDesignForm.ts`
- Modify: `apps/mobile/src/feed/Feed.test.tsx:12`, `apps/mobile/src/profile/TailorProfileBody.test.tsx:5`, `apps/mobile/src/components/DesignCard.test.tsx:9`, `apps/mobile/src/design/Design.test.tsx:39` (builders `Design` — ajout des défauts pour garder le typecheck vert)

**Interfaces:**
- Consumes: `PostType` de `@moodly/shared` (Task 1).
- Produces: `Design` mobile porte `postType: PostType` et `sourceCredit: string | null`. `PublishInput` porte `postType: PostType` et `sourceCredit?: string`. `buildDesignForm` ajoute `postType` au multipart, et `sourceCredit` seulement pour une inspiration créditée.

- [ ] **Step 1: Étendre le type `Design`**

Dans `apps/mobile/src/types.ts`, ajouter l'import du type partagé (regrouper avec l'import `@moodly/shared` existant si présent, sinon ajouter) :

```ts
import type { PostType } from '@moodly/shared';
```

Dans `export type Design = { … }`, ajouter juste après `category: DesignCategory;` :

```ts
  postType: PostType;
  sourceCredit: string | null;
```

- [ ] **Step 2: Étendre `PublishInput` et `buildDesignForm`**

Remplacer le contenu de `apps/mobile/src/designs/buildDesignForm.ts` par :

```ts
import type { DesignCategory, PostType } from '@moodly/shared';

export type PublishInput = {
  uris: string[];
  title: string;
  category: DesignCategory;
  description?: string;
  postType: PostType;
  sourceCredit?: string;
};

function fileFromUri(uri: string) {
  const name = uri.split('/').pop() ?? 'model.jpg';
  const ext = (name.split('.').pop() ?? 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { uri, name, type };
}

/** Construit le multipart de publication : chaque image sous le champ `media`. */
export function buildDesignForm(input: PublishInput): FormData {
  const form = new FormData();
  form.append('title', input.title);
  form.append('category', input.category);
  if (input.description) form.append('description', input.description);
  form.append('postType', input.postType);
  // Une création originale n'a pas de source externe : on n'envoie le crédit
  // que pour une inspiration.
  if (input.postType === 'INSPIRATION' && input.sourceCredit) {
    form.append('sourceCredit', input.sourceCredit);
  }
  for (const uri of input.uris) {
    form.append('media', fileFromUri(uri) as unknown as Blob);
  }
  return form;
}
```

- [ ] **Step 3: Mettre à jour les 4 builders `Design` des tests**

Dans chacun de ces objets littéraux `Design`, ajouter les deux champs (défauts) pour que le typecheck reste vert :

```ts
  postType: 'INSPIRATION',
  sourceCredit: null,
```

- `apps/mobile/src/feed/Feed.test.tsx` (`const design: Design = {` ligne ~12)
- `apps/mobile/src/profile/TailorProfileBody.test.tsx` (`const design: Design = {` ligne ~5)
- `apps/mobile/src/components/DesignCard.test.tsx` (`const base: Design = {` ligne ~9)
- `apps/mobile/src/design/Design.test.tsx` (dans `makeDesign`, ajouter les deux champs aux valeurs par défaut de l'objet retourné, avant le spread `...over`)

- [ ] **Step 4: Vérifier le typecheck mobile**

Run: `npm run typecheck -w @moodly/mobile`
Expected: PASS (aucune propriété manquante sur les littéraux `Design`).

- [ ] **Step 5: Lancer les tests mobile impactés**

Run: `npm test -w @moodly/mobile -- Feed DesignCard TailorProfileBody Design`
Expected: PASS (comportement inchangé, builders complétés).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/types.ts apps/mobile/src/designs/buildDesignForm.ts \
  apps/mobile/src/feed/Feed.test.tsx apps/mobile/src/profile/TailorProfileBody.test.tsx \
  apps/mobile/src/components/DesignCard.test.tsx apps/mobile/src/design/Design.test.tsx
git commit -m "feat(mobile): postType/sourceCredit dans le type Design + multipart (M8)"
```

---

### Task 7: Assistant de publication `PublishWizard`

**Files:**
- Create: `apps/mobile/src/publish/PublishWizard.tsx`
- Create: `apps/mobile/src/publish/PublishWizard.test.tsx`
- Modify: `apps/mobile/app/publish.tsx` (devient un ré-export)

**Interfaces:**
- Consumes: `usePublishDesign()` (inchangé) et `PublishInput` (Task 6).
- Produces: composant `export default function PublishWizard()` — assistant 3 étapes (Média → Essentiel → Finitions), envoie `{ uris, title, category, description, postType, sourceCredit }` au hook.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/mobile/src/publish/PublishWizard.test.tsx` :

```ts
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PublishWizard from './PublishWizard';
import { usePublishDesign } from '../designs/hooks';

jest.mock('../designs/hooks');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));

// La galerie renvoie 1 photo choisie.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photo1.jpg' }],
  }),
}));

const mockedUsePublish = usePublishDesign as jest.MockedFunction<typeof usePublishDesign>;

describe('PublishWizard', () => {
  beforeEach(() => mockReplace.mockClear());

  it('parcourt les 3 étapes et publie une création originale (sourceCredit non envoyé)', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    mockedUsePublish.mockReturnValue({ publish, publishing: false });
    render(<PublishWizard />);

    // Étape 1 — Média : la galerie s'ouvre au montage et renvoie 1 photo.
    await waitFor(() => expect(screen.getByText('Suivant')).toBeTruthy());
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 2 — L'essentiel : titre + catégorie.
    fireEvent.changeText(screen.getByPlaceholderText('Boubou brodé, Robe wax…'), 'Ma création');
    fireEvent.press(screen.getByText('Robe'));
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 3 — Finitions : passer en Création originale puis publier.
    fireEvent.press(screen.getByText('Création originale'));
    fireEvent.press(screen.getByText('Publier'));

    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][0]).toMatchObject({
      uris: ['file:///photo1.jpg'],
      title: 'Ma création',
      category: 'ROBE',
      postType: 'ORIGINAL',
    });
    expect(publish.mock.calls[0][0].sourceCredit).toBeUndefined();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/profile'));
  });

  it('publie une inspiration avec source', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    mockedUsePublish.mockReturnValue({ publish, publishing: false });
    render(<PublishWizard />);

    await waitFor(() => expect(screen.getByText('Suivant')).toBeTruthy());
    fireEvent.press(screen.getByText('Suivant'));
    fireEvent.changeText(screen.getByPlaceholderText('Boubou brodé, Robe wax…'), 'Inspiration');
    fireEvent.press(screen.getByText('Boubou'));
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 3 : Inspiration est le défaut → le champ Source apparaît.
    fireEvent.changeText(screen.getByPlaceholderText('Crédit ou lien (optionnel)'), 'Pinterest');
    fireEvent.press(screen.getByText('Publier'));

    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][0]).toMatchObject({
      postType: 'INSPIRATION',
      sourceCredit: 'Pinterest',
    });
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -w @moodly/mobile -- PublishWizard`
Expected: FAIL — module `./PublishWizard` introuvable.

- [ ] **Step 3: Implémenter le composant**

Créer `apps/mobile/src/publish/PublishWizard.tsx` :

```tsx
import type { DesignCategory, PostType } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_LABELS, DESIGN_CATEGORIES } from '../designs/categories';
import { usePublishDesign } from '../designs/hooks';
import { colors, fonts, radius, spacing } from '../theme';
import { Button } from '../ui/Button';

const STEPS = ['media', 'essentiel', 'finitions'] as const;
type Step = (typeof STEPS)[number];

export default function PublishWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { publish, publishing } = usePublishDesign();

  const [step, setStep] = useState(0);
  const [uris, setUris] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DesignCategory | null>(null);
  const [description, setDescription] = useState('');
  const [postType, setPostType] = useState<PostType>('INSPIRATION');
  const [sourceCredit, setSourceCredit] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current: Step = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const canAdvance =
    (current === 'media' && uris.length >= 1) ||
    (current === 'essentiel' && title.trim().length > 0 && category !== null) ||
    current === 'finitions';

  async function pickImages() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Autorise l’accès aux photos pour choisir des images.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.9,
    });
    if (!res.canceled) {
      setUris(res.assets.slice(0, 5).map((a) => a.uri));
    }
  }

  // La galerie s'ouvre directement au montage (tap ⊕ Publier). Si l'utilisateur
  // annule sans rien choisir, l'écran d'accueil engageant reste affiché.
  useEffect(() => {
    void pickImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function back() {
    setError(null);
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  async function next() {
    if (!canAdvance) return;
    setError(null);
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    try {
      await publish({
        uris,
        title: title.trim(),
        category: category!,
        description: description.trim() || undefined,
        postType,
        sourceCredit: postType === 'INSPIRATION' && sourceCredit.trim() ? sourceCredit.trim() : undefined,
      });
      router.replace('/(tabs)/profile');
    } catch {
      setError('La publication a échoué. Réessaie.');
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
        {current === 'media' && (
          <>
            <Text style={styles.title}>Tes photos</Text>
            {uris.length > 0 ? (
              <>
                <Image source={{ uri: uris[0] }} style={styles.cover} contentFit="cover" />
                <View style={styles.thumbs}>
                  {uris.map((u, i) => (
                    <Pressable
                      key={u + i}
                      testID="remove-thumb"
                      onPress={() => setUris((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Image source={{ uri: u }} style={styles.thumb} contentFit="cover" />
                      <View style={styles.thumbRemove}>
                        <Feather name="x" size={12} color={colors.textOnDark} />
                      </View>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={styles.addMore} onPress={pickImages}>
                  <Feather name="plus" size={16} color={colors.accent} />
                  <Text style={styles.addMoreText}>Ajouter / remplacer</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.emptyPicker} onPress={pickImages}>
                <Feather name="camera" size={30} color={colors.accent} />
                <Text style={styles.emptyText}>Choisir des photos</Text>
                <Text style={styles.emptyHint}>Jusqu’à 5 · la 1re sera la couverture</Text>
              </Pressable>
            )}
          </>
        )}

        {current === 'essentiel' && (
          <>
            <Text style={styles.title}>L'essentiel</Text>
            <Text style={styles.label}>Titre</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Boubou brodé, Robe wax…"
              placeholderTextColor={colors.textOnDarkMuted}
              style={styles.input}
              autoFocus
            />
            <Text style={[styles.label, { marginTop: spacing.xl }]}>Catégorie</Text>
            <View style={styles.chips}>
              {DESIGN_CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.chip, category === c && styles.chipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                    {CATEGORY_LABELS[c]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {current === 'finitions' && (
          <>
            <Text style={styles.title}>Finitions</Text>
            <Text style={styles.label}>Type de publication</Text>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentItem, postType === 'INSPIRATION' && styles.segmentItemActive]}
                onPress={() => setPostType('INSPIRATION')}
              >
                <Text style={[styles.segmentText, postType === 'INSPIRATION' && styles.segmentTextActive]}>
                  Inspiration
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segmentItem, postType === 'ORIGINAL' && styles.segmentItemActive]}
                onPress={() => setPostType('ORIGINAL')}
              >
                <Text style={[styles.segmentText, postType === 'ORIGINAL' && styles.segmentTextActive]}>
                  Création originale
                </Text>
              </Pressable>
            </View>
            {postType === 'INSPIRATION' ? (
              <>
                <Text style={styles.optionHint}>Contenu de découverte. Ajoute la source si tu la connais.</Text>
                <TextInput
                  value={sourceCredit}
                  onChangeText={setSourceCredit}
                  placeholder="Crédit ou lien (optionnel)"
                  placeholderTextColor={colors.textOnDarkMuted}
                  style={styles.input}
                />
              </>
            ) : (
              <Text style={styles.optionHint}>Ta création. Un filigrane © {'{'}atelier{'}'} protégera tes photos.</Text>
            )}

            <Text style={[styles.label, { marginTop: spacing.xl }]}>Description (optionnel)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tissu, coupe, détails…"
              placeholderTextColor={colors.textOnDarkMuted}
              style={[styles.input, styles.inputMulti]}
              multiline
            />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label={isLast ? 'Publier' : 'Suivant'}
          onPress={next}
          disabled={!canAdvance}
          loading={publishing}
          style={styles.cta}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', height: 40 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkLine },
  dotActive: { width: 20, backgroundColor: colors.textOnDark },
  headerSpacer: { width: 28 },
  body: { paddingTop: spacing.xl, flexGrow: 1, paddingBottom: 120 },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 30, marginBottom: spacing.xl, lineHeight: 36 },
  emptyPicker: {
    height: 320,
    borderRadius: radius.lg,
    backgroundColor: colors.inkElevated,
    borderWidth: 1,
    borderColor: colors.inkLine,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 16 },
  emptyHint: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13 },
  cover: { width: '100%', height: 300, borderRadius: radius.lg, backgroundColor: colors.inkElevated },
  thumbs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  thumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.inkElevated },
  thumbRemove: {
    position: 'absolute',
    top: spacing.xs / 2,
    right: spacing.xs / 2,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(23,18,15,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMore: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  addMoreText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 14 },
  label: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  inputMulti: { height: 100, paddingTop: spacing.md, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.inkElevated,
  },
  chipActive: { backgroundColor: colors.accentSoft },
  chipText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 13 },
  chipTextActive: { color: colors.accent },
  segment: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    borderWidth: 1,
    borderColor: colors.inkLine,
    alignItems: 'center',
  },
  segmentItemActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  segmentText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  segmentTextActive: { color: colors.accent },
  optionHint: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13, marginBottom: spacing.md },
  error: { color: colors.accent, fontFamily: fonts.bodyBold, textAlign: 'center', marginTop: spacing.lg },
  footer: { paddingTop: spacing.md },
  cta: { borderRadius: radius.pill },
});
```

- [ ] **Step 4: Convertir la route en ré-export**

Remplacer **tout** le contenu de `apps/mobile/app/publish.tsx` par :

```tsx
export { default } from '../src/publish/PublishWizard';
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

Run: `npm test -w @moodly/mobile -- PublishWizard`
Expected: PASS (2 cas).

- [ ] **Step 6: Typecheck mobile**

Run: `npm run typecheck -w @moodly/mobile`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/publish/PublishWizard.tsx apps/mobile/src/publish/PublishWizard.test.tsx apps/mobile/app/publish.tsx
git commit -m "feat(mobile): assistant de publication 3 étapes (Média/Essentiel/Finitions) (M8)"
```

---

### Task 8: Affichage de l'attribution (détail + carte)

**Files:**
- Modify: `apps/mobile/src/design/DesignScreen.tsx` (bloc `body`, après l'auteur) + styles
- Modify: `apps/mobile/src/design/Design.test.tsx` (2 cas)
- Modify: `apps/mobile/src/components/DesignCard.tsx` (badge) + styles
- Modify: `apps/mobile/src/components/DesignCard.test.tsx` (1 cas)

**Interfaces:**
- Consumes: `design.postType`, `design.sourceCredit`, `design.createdAt`, `design.tailor` (Task 6).
- Produces: sur le détail, un badge « ✦ Création originale · {date} » (tap → profil) pour `ORIGINAL`, sinon une ligne « Source : … » si `sourceCredit`. Sur la carte, un badge `testID="original-badge"` pour `ORIGINAL`.

- [ ] **Step 1: Écrire les tests qui échouent (détail)**

Ajouter dans `apps/mobile/src/design/Design.test.tsx` (le fichier mocke déjà `useDesign`/`useSimilar` ; s'appuyer sur `makeDesign`, `mockedUseDesign`, `mockedUseSimilar` déjà présents) :

```ts
  it('affiche le badge Création originale pour un ORIGINAL', () => {
    mockedUseSimilar.mockReturnValue({ designs: [] } as unknown as ReturnType<typeof useSimilar>);
    mockedUseDesign.mockReturnValue({
      design: makeDesign({ postType: 'ORIGINAL' }),
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useDesign>);
    render(<DesignScreen id="d1" />);
    expect(screen.getByText(/Création originale/)).toBeTruthy();
  });

  it('affiche la source pour une inspiration créditée', () => {
    mockedUseSimilar.mockReturnValue({ designs: [] } as unknown as ReturnType<typeof useSimilar>);
    mockedUseDesign.mockReturnValue({
      design: makeDesign({ postType: 'INSPIRATION', sourceCredit: 'Pinterest / @awa' }),
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useDesign>);
    render(<DesignScreen id="d1" />);
    expect(screen.getByText(/Source : Pinterest \/ @awa/)).toBeTruthy();
  });
```

> Note : si `makeDesign` n'inclut pas encore `postType`/`sourceCredit` par défaut, les ajouter (Task 6, Step 3). Vérifier que le premier argument de `render` correspond aux props existantes (`DesignScreen id="d1"` suffit — les autres props sont optionnelles).

- [ ] **Step 2: Écrire le test qui échoue (carte)**

Ajouter dans `apps/mobile/src/components/DesignCard.test.tsx` (s'appuyer sur le builder `base` déjà présent) :

```ts
  it('affiche le badge création originale pour un ORIGINAL', () => {
    render(<DesignCard design={{ ...base, postType: 'ORIGINAL' }} onPress={() => {}} />);
    expect(screen.getByTestId('original-badge')).toBeTruthy();
  });

  it('pas de badge original pour une inspiration', () => {
    render(<DesignCard design={{ ...base, postType: 'INSPIRATION' }} onPress={() => {}} />);
    expect(screen.queryByTestId('original-badge')).toBeNull();
  });
```

> Vérifier que `screen` est importé dans ce fichier de test ; sinon l'ajouter à l'import `@testing-library/react-native`.

- [ ] **Step 3: Lancer les tests, vérifier qu'ils échouent**

Run: `npm test -w @moodly/mobile -- Design DesignCard`
Expected: FAIL — ni le badge détail ni le badge carte n'existent encore.

- [ ] **Step 4: Implémenter le badge du détail**

Dans `apps/mobile/src/design/DesignScreen.tsx`, juste après le bloc `<Pressable style={styles.author} …>…</Pressable>` (avant la ligne `{design.description ? …}`), insérer :

```tsx
          {design.postType === 'ORIGINAL' ? (
            <Pressable style={styles.originalBadge} onPress={() => onTailor?.(design.tailor.id)}>
              <Text style={styles.originalMark}>✦</Text>
              <Text style={styles.originalText}>
                Création originale · {new Date(design.createdAt).toLocaleDateString('fr-FR')}
              </Text>
            </Pressable>
          ) : design.sourceCredit ? (
            <Text style={styles.sourceLine}>Source : {design.sourceCredit}</Text>
          ) : null}
```

Ajouter dans le `StyleSheet.create` de ce fichier :

```tsx
  originalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  originalMark: { color: colors.accent, fontFamily: fonts.bodyHeavy, fontSize: 13 },
  originalText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13 },
  sourceLine: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13, marginTop: spacing.md },
```

- [ ] **Step 5: Implémenter le badge de la carte**

Dans `apps/mobile/src/components/DesignCard.tsx`, à l'intérieur du `<View>` qui contient l'`<Image>` (juste après le bloc `{design.mediaCount > 1 ? … : null}`), insérer :

```tsx
        {design.postType === 'ORIGINAL' ? (
          <View testID="original-badge" style={styles.original}>
            <Text style={styles.originalMark}>✦</Text>
          </View>
        ) : null}
```

Ajouter dans le `StyleSheet.create` de ce fichier :

```tsx
  original: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(23,18,15,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  originalMark: { color: colors.accent, fontFamily: fonts.bodyHeavy, fontSize: 12 },
```

- [ ] **Step 6: Lancer les tests, vérifier qu'ils passent**

Run: `npm test -w @moodly/mobile -- Design DesignCard`
Expected: PASS

- [ ] **Step 7: Typecheck + suite mobile complète**

Run: `npm run typecheck -w @moodly/mobile && npm test -w @moodly/mobile`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/design/DesignScreen.tsx apps/mobile/src/design/Design.test.tsx \
  apps/mobile/src/components/DesignCard.tsx apps/mobile/src/components/DesignCard.test.tsx
git commit -m "feat(mobile): badge Création originale + ligne Source (détail & carte) (M8)"
```

---

## Vérification finale (après toutes les tâches)

- [ ] **API — suite complète**

Run: `npm test -w @moodly/api`
Expected: PASS

- [ ] **Mobile — suite complète + typecheck**

Run: `npm test -w @moodly/mobile && npm run typecheck -w @moodly/mobile`
Expected: PASS

- [ ] **Shared — suite**

Run: `npm test -w @moodly/shared`
Expected: PASS
