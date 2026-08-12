# Bloc A — Média multi-format — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un modèle de porter plusieurs images (1 à 5, schéma prêt pour la vidéo), avec une cover dénormalisée + un placeholder blurhash, rendus au feed masonry (indicateur multi-média + flou→net).

**Architecture:** Nouvelle table relationnelle `Media` (Design 1—∞ Media, `position` ordonnée), `Design` garde une cover dénormalisée (`imageUrl/imageWidth/imageHeight` + `coverBlurhash` + `mediaCount`) pour que le feed reste sans jointure. L'upload accepte jusqu'à 5 images, calcule un blurhash par image (lib `blurhash` + sharp). Le mobile affiche le placeholder blurhash et un badge multi-média.

**Tech Stack:** Express 5, Prisma 6 (pinné), PostgreSQL, multer, sharp, blurhash ; Expo SDK 54, expo-image (placeholder blurhash natif), expo-image-picker ; Vitest+Supertest (API), jest-expo+RNTL (mobile).

## Global Constraints

- **Prisma 6 pinné** — ne pas monter en 7.
- **Images en chemin relatif** — `storage` renvoie `/uploads/x.webp` ; le mobile préfixe via `imageUri()` (`src/lib/config.ts`). Ne pas réintroduire d'URL absolue.
- **Tokens de thème only** côté mobile (`src/theme.ts`) ; jamais de `fontWeight`.
- **Français simple** dans l'UI et les messages d'erreur.
- **Jusqu'à 5 images** par modèle ; **1 minimum**.
- **Vidéo : schéma prêt, pas de pipeline** (pas d'upload/lecture vidéo dans ce bloc).
- **Carrousel du détail = bloc D** (hors périmètre ici).
- Ne pas casser les **86 tests API** ni les **36 tests mobile** existants.
- Commandes : API depuis `apps/api` (`npx vitest run`, `npx tsc --noEmit`) ; mobile depuis `apps/mobile` (`npx jest`, `npx tsc --noEmit`). DB dev = conteneur `moodly-db-1` (Docker, port 5433) — `docker compose up -d` si éteint.

---

### Task 1: Schéma Prisma — enum `MediaType`, table `Media`, cover `Design` + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_media/migration.sql` (généré par Prisma)

**Interfaces:**
- Produces: table `media` + colonnes `designs.coverBlurhash` (nullable), `designs.mediaCount` (default 1) ; relation `Design.media Media[]` ; enum `MediaType { IMAGE, VIDEO }`.

- [ ] **Step 1: S'assurer que la DB dev tourne**

Run: `docker compose up -d` (à la racine du repo)
Expected: `moodly-db-1` Running (port 5433).

- [ ] **Step 2: Éditer le schéma**

Dans `apps/api/prisma/schema.prisma`, ajouter l'enum et le modèle (après les autres enums / près de `Design`) :

```prisma
enum MediaType {
  IMAGE
  VIDEO
}

model Media {
  id           String    @id @default(cuid())
  design       Design    @relation(fields: [designId], references: [id], onDelete: Cascade)
  designId     String
  type         MediaType @default(IMAGE)
  url          String
  thumbnailUrl String?
  width        Int
  height       Int
  duration     Int?
  blurhash     String?
  position     Int
  createdAt    DateTime  @default(now())

  @@index([designId, position])
  @@map("media")
}
```

Et dans `model Design`, ajouter deux colonnes et la relation inverse (à côté de `imageHeight` et des autres relations) :

```prisma
  coverBlurhash  String?
  mediaCount     Int            @default(1)
  media          Media[]
```

- [ ] **Step 3: Générer la migration + le client**

Run: `cd apps/api && npx dotenv -e .env -- prisma migrate dev --name add_media`
Expected: migration créée sous `prisma/migrations/…_add_media/`, appliquée à la DB dev, client régénéré. (Le projet lit `DATABASE_URL` depuis `apps/api/.env`.)

- [ ] **Step 4: Vérifier la non-régression**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: typecheck clean ; **86 tests toujours verts** (les insertions directes de `Design` restent valides : `mediaCount` a un défaut, `coverBlurhash` est nullable, `media` est une relation optionnelle).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): schéma média (enum MediaType, table Media, cover dénormalisée)"
```

---

### Task 2: Util `computeBlurhash` + `storage` renvoie un blurhash

**Files:**
- Create: `apps/api/src/lib/blurhash.ts`
- Create: `apps/api/tests/blurhash.test.ts`
- Modify: `apps/api/src/lib/storage.ts`
- Modify: `apps/api/package.json` (dépendance `blurhash`)

**Interfaces:**
- Produces:
  - `computeBlurhash(buffer: Buffer): Promise<string>`
  - `StoredImage` gagne `blurhash: string` ; `storage.save(buffer)` le renseigne.

- [ ] **Step 1: Installer la dépendance**

Run: `npm install blurhash` (à la racine du repo — deps hoistées)
Expected: `blurhash` ajouté.

- [ ] **Step 2: Écrire le test qui échoue**

```typescript
// apps/api/tests/blurhash.test.ts
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { decode } from 'blurhash';
import { computeBlurhash } from '../src/lib/blurhash.js';

describe('computeBlurhash', () => {
  it('produit un blurhash décodable pour une image', async () => {
    const buf = await sharp({
      create: { width: 100, height: 120, channels: 3, background: { r: 180, g: 90, b: 40 } },
    })
      .png()
      .toBuffer();
    const hash = await computeBlurhash(buf);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(6);
    // décodable sans lever
    expect(() => decode(hash, 32, 32)).not.toThrow();
  });
});
```

- [ ] **Step 3: Lancer le test (échec attendu)**

Run: `cd apps/api && npx vitest run tests/blurhash.test.ts`
Expected: FAIL — module `../src/lib/blurhash.js` introuvable.

- [ ] **Step 4: Implémenter `computeBlurhash`**

```typescript
// apps/api/src/lib/blurhash.ts
import { encode } from 'blurhash';
import sharp from 'sharp';

/** Placeholder flou compact (façon Insta/Pinterest), calculé depuis les pixels. */
export async function computeBlurhash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}
```

- [ ] **Step 5: Lancer le test (succès attendu)**

Run: `cd apps/api && npx vitest run tests/blurhash.test.ts`
Expected: PASS.

- [ ] **Step 6: Brancher le blurhash dans `storage`**

Dans `apps/api/src/lib/storage.ts` :

Le type gagne un champ :

```typescript
export type StoredImage = { url: string; width: number; height: number; blurhash: string };
```

Importer le util en haut : `import { computeBlurhash } from './blurhash.js';`

Dans `LocalDiskStorage.save`, calculer le blurhash à partir du buffer d'origine et le renvoyer :

```typescript
    await writeFile(path.join(this.dir, fileName), webp);
    const blurhash = await computeBlurhash(buffer);
    // Chemin relatif : l'app le préfixe avec l'URL de l'API qu'elle détecte.
    return { url: `/uploads/${fileName}`, width, height, blurhash };
```

Dans `CloudinaryStorage.save`, renvoyer aussi un blurhash (même util, depuis le buffer reçu) :

```typescript
  async save(buffer: Buffer): Promise<StoredImage> {
    const blurhash = await computeBlurhash(buffer);
    const result = await new Promise<{ secure_url: string; width: number; height: number }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: 'moodly/designs' }, (err, res) => {
            if (err || !res) reject(err ?? new Error('Réponse Cloudinary vide'));
            else resolve(res);
          })
          .end(buffer);
      },
    );
    return { url: result.secure_url, width: result.width, height: result.height, blurhash };
  }
```

- [ ] **Step 7: Vérifier storage + non-régression**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run tests/storage.test.ts tests/blurhash.test.ts`
Expected: PASS (le test storage existant vérifie déjà `url` en `/uploads/x.webp` — inchangé).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/lib/blurhash.ts apps/api/tests/blurhash.test.ts apps/api/src/lib/storage.ts package.json package-lock.json
git commit -m "feat(api): génération de blurhash à l'upload (placeholder)"
```

---

### Task 3: Lecture API — `designInclude` + `toApiDesign` exposent `media[]`, `coverBlurhash`, `mediaCount`

**Files:**
- Modify: `apps/api/src/modules/designs/designs.service.ts`
- Create: `apps/api/tests/media-read.test.ts`

**Interfaces:**
- Consumes: table `media` (Task 1).
- Produces: la réponse design contient `media: ApiMedia[]` (ordonné par `position asc`), plus `coverBlurhash` et `mediaCount` (déjà colonnes de `Design`, donc dans le spread). `ApiMedia = { id, type, url, thumbnailUrl, width, height, duration, blurhash, position }`.

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// apps/api/tests/media-read.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let tailorId: string;
let designId: string;

beforeAll(async () => {
  const tailor = await prisma.user.create({
    data: { phone: '+221770001111', name: 'Média Tailleur', role: 'TAILLEUR', passwordHash: 'x' },
  });
  tailorId = tailor.id;
  const design = await prisma.design.create({
    data: {
      tailorId,
      title: 'Trois vues',
      category: 'BOUBOU',
      imageUrl: '/uploads/a.webp',
      imageWidth: 600,
      imageHeight: 800,
      coverBlurhash: 'LEHV6nWB2yk8',
      mediaCount: 2,
      media: {
        create: [
          { type: 'IMAGE', url: '/uploads/a.webp', width: 600, height: 800, blurhash: 'LEHV6nWB2yk8', position: 0 },
          { type: 'IMAGE', url: '/uploads/b.webp', width: 600, height: 900, blurhash: 'L6Pj0^jE', position: 1 },
        ],
      },
    },
  });
  designId = design.id;
});

afterAll(async () => {
  await prisma.design.deleteMany({ where: { tailorId } });
  await prisma.user.deleteMany({ where: { id: tailorId } });
});

describe('lecture média', () => {
  it('GET /designs/:id renvoie media[] ordonné + cover + mediaCount', async () => {
    const res = await request(app).get(`/designs/${designId}`);
    expect(res.status).toBe(200);
    expect(res.body.design.mediaCount).toBe(2);
    expect(res.body.design.coverBlurhash).toBe('LEHV6nWB2yk8');
    expect(res.body.design.media).toHaveLength(2);
    expect(res.body.design.media[0].position).toBe(0);
    expect(res.body.design.media[1].position).toBe(1);
    expect(res.body.design.media[0].url).toBe('/uploads/a.webp');
  });

  it('GET /designs (feed) renvoie media[] et mediaCount', async () => {
    const res = await request(app).get('/designs?limit=50');
    const found = res.body.designs.find((d: { id: string }) => d.id === designId);
    expect(found.mediaCount).toBe(2);
    expect(found.media).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/api && npx vitest run tests/media-read.test.ts`
Expected: FAIL — `media` absent de la réponse (undefined).

- [ ] **Step 3: Inclure et mapper `media`**

Dans `apps/api/src/modules/designs/designs.service.ts` :

`designInclude` inclut les médias ordonnés :

```typescript
export function designInclude(viewerId: string) {
  return {
    tailor: { select: publicUserSelect },
    likes: { where: { userId: viewerId }, select: { id: true } },
    bookmarks: { where: { userId: viewerId }, select: { id: true } },
    media: { orderBy: { position: 'asc' as const } },
  } satisfies Prisma.DesignInclude;
}
```

`toApiDesign` expose un tableau média « public » (retire `designId`/`createdAt`) ; `coverBlurhash` et `mediaCount` sont déjà dans `rest` :

```typescript
export function toApiDesign(design: DesignWithViewer) {
  const { likes, bookmarks, media, ...rest } = design;
  return {
    ...rest,
    media: media.map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      width: m.width,
      height: m.height,
      duration: m.duration,
      blurhash: m.blurhash,
      position: m.position,
    })),
    likedByMe: likes.length > 0,
    bookmarkedByMe: bookmarks.length > 0,
  };
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd apps/api && npx vitest run tests/media-read.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Non-régression**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: typecheck clean ; tous les tests verts (les designs sans média renvoient `media: []`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/designs/designs.service.ts apps/api/tests/media-read.test.ts
git commit -m "feat(api): exposer media[], coverBlurhash et mediaCount"
```

---

### Task 4: Upload multi-images — `POST /designs` accepte 1 à 5 images

**Files:**
- Modify: `apps/api/src/modules/designs/designs.routes.ts:82-117`
- Create: `apps/api/tests/media-upload.test.ts`

**Interfaces:**
- Consumes: `storage.save` (→ `blurhash`, Task 2), `designInclude`/`toApiDesign` (Task 3).
- Produces: `POST /designs` (champ multipart **`media`**, 1..5 fichiers) crée les `Media` ordonnés, fixe la cover (1er) + `coverBlurhash` + `mediaCount`.

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// apps/api/tests/media-upload.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { signAccessToken } from '../src/lib/jwt.js';

let tailorId: string;
let token: string;

async function png(w: number, h: number) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 100, g: 120, b: 140 } } })
    .png()
    .toBuffer();
}

beforeAll(async () => {
  const tailor = await prisma.user.create({
    data: { phone: '+221770002222', name: 'Upload Tailleur', role: 'TAILLEUR', passwordHash: 'x' },
  });
  tailorId = tailor.id;
  token = signAccessToken({ sub: tailor.id, role: 'TAILLEUR' });
});

afterAll(async () => {
  await prisma.design.deleteMany({ where: { tailorId } });
  await prisma.user.deleteMany({ where: { id: tailorId } });
});

describe('upload multi-images', () => {
  it('publie 3 images → 3 Media ordonnés, cover = 1re, mediaCount = 3, blurhash présents', async () => {
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Carrousel')
      .field('category', 'ENSEMBLE')
      .attach('media', await png(600, 800), 'a.png')
      .attach('media', await png(600, 900), 'b.png')
      .attach('media', await png(600, 700), 'c.png');
    expect(res.status).toBe(201);
    expect(res.body.design.mediaCount).toBe(3);
    expect(res.body.design.media).toHaveLength(3);
    expect(res.body.design.media[0].position).toBe(0);
    expect(res.body.design.media[2].position).toBe(2);
    expect(res.body.design.imageUrl).toBe(res.body.design.media[0].url);
    expect(res.body.design.coverBlurhash).toEqual(expect.any(String));
    expect(res.body.design.media[0].blurhash).toEqual(expect.any(String));
  });

  it('refuse 0 image (400)', async () => {
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Sans image')
      .field('category', 'ROBE');
    expect(res.status).toBe(400);
  });

  it('refuse 6 images (400)', async () => {
    const req = request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Trop')
      .field('category', 'ROBE');
    for (let i = 0; i < 6; i++) req.attach('media', await png(600, 800), `x${i}.png`);
    const res = await req;
    expect(res.status).toBe(400);
  });

  it('refuse un fichier non-image (400)', async () => {
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'PDF')
      .field('category', 'ROBE')
      .attach('media', Buffer.from('%PDF-1.4 fake'), { filename: 'f.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/api && npx vitest run tests/media-upload.test.ts`
Expected: FAIL (le endpoint attend encore `image` unique).

- [ ] **Step 3: Réécrire le handler `POST /designs`**

Dans `apps/api/src/modules/designs/designs.routes.ts`, remplacer le bloc `designsRouter.post('/', …)` (lignes ~82-117) par :

```typescript
designsRouter.post(
  '/',
  requireAuth,
  requireRole('TAILLEUR'),
  upload.array('media', 5),
  async (req, res) => {
    const parsed = createDesignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw new ApiError(400, 'IMAGE_REQUISE', 'Ajoute au moins une photo du modèle.');
    }
    if (files.length > 5) {
      throw new ApiError(400, 'TROP_IMAGES', 'Maximum 5 images par modèle.');
    }
    for (const f of files) {
      if (!ALLOWED_MIMES.includes(f.mimetype)) {
        throw new ApiError(400, 'FORMAT_IMAGE_INVALIDE', 'Formats acceptés : JPEG, PNG ou WebP.');
      }
    }

    const stored = await Promise.all(files.map((f) => storage.save(f.buffer)));
    const cover = stored[0];

    const design = await prisma.design.create({
      data: {
        tailorId: req.user!.sub,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        imageUrl: cover.url,
        imageWidth: cover.width,
        imageHeight: cover.height,
        coverBlurhash: cover.blurhash,
        mediaCount: stored.length,
        media: {
          create: stored.map((s, i) => ({
            type: 'IMAGE' as const,
            url: s.url,
            width: s.width,
            height: s.height,
            blurhash: s.blurhash,
            position: i,
          })),
        },
      },
      include: designInclude(req.user!.sub),
    });
    res.status(201).json({ design: toApiDesign(design) });
  },
);
```

(Le `multer` `upload` et `ALLOWED_MIMES` existants sont réutilisés tels quels.)

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd apps/api && npx vitest run tests/media-upload.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Non-régression complète**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: typecheck clean ; tous verts. (Note : un éventuel test existant qui publiait via le champ `image` doit être mis à jour vers `media` — chercher `.attach('image'` dans `tests/` et remplacer par `.attach('media'`. Refaire tourner.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/designs/designs.routes.ts apps/api/tests/media-upload.test.ts
git commit -m "feat(api): upload multi-images (1 à 5) avec Media ordonnés + cover"
```

---

### Task 5: Backfill des modèles existants (cover → Media + blurhash)

**Files:**
- Create: `apps/api/src/lib/backfillMedia.ts`
- Create: `apps/api/tests/backfill-media.test.ts`
- Create: `apps/api/scripts/backfill-media.mjs`

**Interfaces:**
- Consumes: `computeBlurhash` (Task 2).
- Produces: `backfillDesignMedia(readImage?): Promise<number>` — pour chaque `Design` **sans média**, crée 1 `Media` (`position 0`) depuis la cover, calcule le blurhash si l'image est lisible (via `readImage(url) => Buffer | null`, défaut : lit `UPLOADS_DIR`), pose `coverBlurhash`, renvoie le nombre de designs traités.

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// apps/api/tests/backfill-media.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { backfillDesignMedia } from '../src/lib/backfillMedia.js';

let tailorId: string;
let designId: string;

beforeAll(async () => {
  const tailor = await prisma.user.create({
    data: { phone: '+221770003333', name: 'Backfill', role: 'TAILLEUR', passwordHash: 'x' },
  });
  tailorId = tailor.id;
  const d = await prisma.design.create({
    data: { tailorId, title: 'Ancien', category: 'ROBE', imageUrl: '/uploads/old.webp', imageWidth: 600, imageHeight: 800 },
  });
  designId = d.id;
});

afterAll(async () => {
  await prisma.design.deleteMany({ where: { tailorId } });
  await prisma.user.deleteMany({ where: { id: tailorId } });
});

describe('backfillDesignMedia', () => {
  it('crée un Media position 0 depuis la cover pour un design sans média', async () => {
    // readImage renvoie null (fichier absent) → blurhash null toléré
    const count = await backfillDesignMedia(async () => null);
    expect(count).toBeGreaterThanOrEqual(1);
    const media = await prisma.media.findMany({ where: { designId } });
    expect(media).toHaveLength(1);
    expect(media[0].position).toBe(0);
    expect(media[0].url).toBe('/uploads/old.webp');
    expect(media[0].type).toBe('IMAGE');
  });

  it('est idempotent (ne recrée pas de média)', async () => {
    await backfillDesignMedia(async () => null);
    const media = await prisma.media.findMany({ where: { designId } });
    expect(media).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/api && npx vitest run tests/backfill-media.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le backfill**

```typescript
// apps/api/src/lib/backfillMedia.ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { computeBlurhash } from './blurhash.js';
import { prisma } from './prisma.js';

type ReadImage = (url: string) => Promise<Buffer | null>;

/** Lit une image depuis UPLOADS_DIR à partir de son chemin relatif /uploads/x. */
const readFromDisk: ReadImage = async (url) => {
  const dir = path.resolve(process.env.UPLOADS_DIR ?? './uploads');
  const file = url.split('/uploads/')[1];
  if (!file) return null;
  try {
    return await readFile(path.join(dir, file));
  } catch {
    return null;
  }
};

/** Crée un Media (position 0) pour chaque Design sans média. Idempotent. */
export async function backfillDesignMedia(readImage: ReadImage = readFromDisk): Promise<number> {
  const designs = await prisma.design.findMany({
    where: { media: { none: {} } },
    select: { id: true, imageUrl: true, imageWidth: true, imageHeight: true },
  });
  let done = 0;
  for (const d of designs) {
    const buf = await readImage(d.imageUrl);
    const blurhash = buf ? await computeBlurhash(buf) : null;
    await prisma.$transaction([
      prisma.media.create({
        data: {
          designId: d.id,
          type: 'IMAGE',
          url: d.imageUrl,
          width: d.imageWidth,
          height: d.imageHeight,
          blurhash,
          position: 0,
        },
      }),
      prisma.design.update({ where: { id: d.id }, data: { coverBlurhash: blurhash, mediaCount: 1 } }),
    ]);
    done++;
  }
  return done;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd apps/api && npx vitest run tests/backfill-media.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Script exécutable (dev)**

```javascript
// apps/api/scripts/backfill-media.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url).pathname });
const { backfillDesignMedia } = await import('../src/lib/backfillMedia.ts');
const n = await backfillDesignMedia();
console.log(`Backfill média : ${n} design(s) traité(s).`);
process.exit(0);
```

(Note : le script est exécuté via `tsx` pour lire le TS ; voir Task 10 de vérification finale.)

- [ ] **Step 6: Non-régression + commit**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: tout vert.

```bash
git add apps/api/src/lib/backfillMedia.ts apps/api/tests/backfill-media.test.ts apps/api/scripts/backfill-media.mjs
git commit -m "feat(api): backfill média des modèles existants (cover → Media + blurhash)"
```

---

### Task 6: `coverBlurhash` dans les snapshots commande (API)

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts:64,77`

**Interfaces:**
- Produces: `order.design` inclut `coverBlurhash` (en plus de `id/title/imageUrl`).

- [ ] **Step 1: Ajouter le champ au `select` (deux endroits)**

Dans `apps/api/src/modules/orders/orders.routes.ts`, aux deux `select` du design (lignes ~64 et ~77), passer de :

```typescript
      design: { select: { id: true, title: true, imageUrl: true } },
```

à :

```typescript
      design: { select: { id: true, title: true, imageUrl: true, coverBlurhash: true } },
```

- [ ] **Step 2: Vérifier (non-régression, le champ est additif)**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run tests/orders.test.ts`
Expected: PASS (les tests commande ne cassent pas ; `coverBlurhash` est renvoyé, potentiellement `null`).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/orders/orders.routes.ts
git commit -m "feat(api): coverBlurhash dans le snapshot design des commandes"
```

---

### Task 7: Types mobile + fixtures — `Media`, `Design.media/coverBlurhash/mediaCount`, `OrderDesign.coverBlurhash`

**Files:**
- Modify: `apps/mobile/src/types.ts`
- Modify: `apps/mobile/src/components/DesignCard.test.tsx`
- Modify: `apps/mobile/src/feed/Feed.test.tsx`
- Modify: `apps/mobile/src/profile/TailorProfileBody.test.tsx`

**Interfaces:**
- Produces: `type MediaType`, `type Media`, `Design` gagne `media/coverBlurhash/mediaCount`, `OrderDesign` gagne `coverBlurhash`.

- [ ] **Step 1: Étendre les types**

Dans `apps/mobile/src/types.ts`, ajouter après `ApiUser` :

```typescript
export type MediaType = 'IMAGE' | 'VIDEO';

export type Media = {
  id: string;
  type: MediaType;
  url: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  duration: number | null;
  blurhash: string | null;
  position: number;
};
```

Dans `Design`, ajouter (après `imageHeight`) :

```typescript
  coverBlurhash: string | null;
  mediaCount: number;
  media: Media[];
```

Et remplacer la ligne `OrderDesign` par :

```typescript
export type OrderDesign = { id: string; title: string; imageUrl: string; coverBlurhash: string | null } | null;
```

- [ ] **Step 2: Mettre à jour les fixtures `Design` des tests existants**

Dans **chaque** littéral `Design` de `DesignCard.test.tsx`, `Feed.test.tsx` et `profile/TailorProfileBody.test.tsx`, ajouter les trois champs (à côté de `imageHeight`) :

```typescript
  coverBlurhash: null,
  mediaCount: 1,
  media: [],
```

- [ ] **Step 3: Typecheck + suite mobile (verte)**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean (les fixtures satisfont maintenant `Design`) ; toute la suite verte (aucun changement de comportement — `DesignCard` n'est pas encore modifié).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/types.ts apps/mobile/src/components/DesignCard.test.tsx apps/mobile/src/feed/Feed.test.tsx apps/mobile/src/profile/TailorProfileBody.test.tsx
git commit -m "feat(mobile): types Media + champs média sur Design/OrderDesign (+ fixtures)"
```

---

### Task 8: `DesignCard` — placeholder blurhash + indicateur multi-média

**Files:**
- Modify: `apps/mobile/src/components/DesignCard.tsx`
- Modify: `apps/mobile/src/components/DesignCard.test.tsx`

**Interfaces:**
- Consumes: `Design.coverBlurhash`, `Design.mediaCount` (fixtures déjà à jour, Task 7), `imageUri` (`../lib/config`).
- Produces: `DesignCard` affiche `placeholder={{ blurhash }}` et un badge `testID="multi-indicator"` si `mediaCount > 1`.

- [ ] **Step 1: Réécrire le test de `DesignCard` (fixture à jour + indicateur)**

Remplacer le premier test de `DesignCard.test.tsx` (rendu image + titre) et ajouter l'indicateur. Le fichier devient :

```tsx
import { render, screen } from '@testing-library/react-native';
import { DesignCard } from './DesignCard';
import type { Design } from '../types';

const base: Design = {
  id: 'd1',
  title: 'Boubou Tabaski',
  description: null,
  category: 'TABASKI',
  imageUrl: 'http://x/img.webp',
  imageWidth: 600,
  imageHeight: 900,
  coverBlurhash: null,
  mediaCount: 1,
  media: [],
  likesCount: 3,
  commentsCount: 1,
  bookmarksCount: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  tailor: { id: 't1', name: 'Atelier Awa', avatarUrl: null },
  likedByMe: false,
  bookmarkedByMe: false,
};

describe('DesignCard', () => {
  it('affiche l’image et un titre sobre (sans bandeau)', () => {
    render(<DesignCard design={base} onPress={() => {}} />);
    expect(screen.getByTestId('design-image')).toBeTruthy();
    expect(screen.getByText('Boubou Tabaski')).toBeTruthy();
    expect(screen.queryByText('Atelier Awa')).toBeNull();
  });

  it('préserve le ratio réel de l’image (Pinterest)', () => {
    render(<DesignCard design={base} onPress={() => {}} />);
    const image = screen.getByTestId('design-image');
    const flat = Array.isArray(image.props.style)
      ? Object.assign({}, ...image.props.style)
      : image.props.style;
    expect(flat.aspectRatio).toBeCloseTo(600 / 900);
  });

  it('affiche l’indicateur multi-média quand mediaCount > 1', () => {
    render(<DesignCard design={{ ...base, mediaCount: 3 }} onPress={() => {}} />);
    expect(screen.getByTestId('multi-indicator')).toBeTruthy();
  });

  it('n’affiche pas l’indicateur pour une seule image', () => {
    render(<DesignCard design={base} onPress={() => {}} />);
    expect(screen.queryByTestId('multi-indicator')).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/mobile && npx jest src/components/DesignCard.test.tsx`
Expected: FAIL — pas de `multi-indicator`.

- [ ] **Step 3: Mettre à jour `DesignCard`**

```tsx
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUri } from '../lib/config';
import { colors, fonts, radius, spacing } from '../theme';
import type { Design } from '../types';

type Props = {
  design: Design;
  onPress: () => void;
};

// Carte façon Pinterest : image arrondie = la carte, placeholder flou, badge multi-média.
export function DesignCard({ design, onPress }: Props) {
  const ratio = design.imageWidth / design.imageHeight;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View>
        <Image
          testID="design-image"
          source={{ uri: imageUri(design.imageUrl) }}
          placeholder={design.coverBlurhash ? { blurhash: design.coverBlurhash } : undefined}
          style={[styles.image, { aspectRatio: ratio }]}
          contentFit="cover"
          transition={180}
        />
        {design.mediaCount > 1 ? (
          <View testID="multi-indicator" style={styles.multi}>
            <Feather name="copy" size={13} color={colors.textOnDark} />
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {design.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  pressed: { opacity: 0.92 },
  image: { width: '100%', borderRadius: radius.md, backgroundColor: colors.inkElevated },
  multi: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(23,18,15,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
});
```

- [ ] **Step 4: Lancer les tests (succès attendu)**

Run: `cd apps/mobile && npx jest src/components/DesignCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + suite complète**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean ; toute la suite verte.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/DesignCard.tsx apps/mobile/src/components/DesignCard.test.tsx
git commit -m "feat(mobile): placeholder blurhash + indicateur multi-média sur la carte"
```

---

### Task 9: Publication multi-images (mobile)

**Files:**
- Modify: `apps/mobile/src/designs/hooks.ts`
- Create: `apps/mobile/src/designs/buildDesignForm.ts`
- Create: `apps/mobile/src/designs/buildDesignForm.test.ts`
- Modify: `apps/mobile/app/publish.tsx`

**Interfaces:**
- Consumes: `apiUpload` (`../lib/api`).
- Produces:
  - `buildDesignForm(input: { uris: string[]; title: string; category: DesignCategory; description?: string }): FormData` — ajoute chaque image sous le champ `media` (ordre préservé).
  - `usePublishDesign().publish(input)` prend `uris: string[]`.

- [ ] **Step 1: Écrire le test qui échoue (fonction pure)**

```typescript
// apps/mobile/src/designs/buildDesignForm.test.ts
import { buildDesignForm } from './buildDesignForm';

function entries(form: FormData): [string, unknown][] {
  // @ts-expect-error accès interne RN FormData pour le test
  return (form as unknown as { _parts: [string, unknown][] })._parts;
}

describe('buildDesignForm', () => {
  it('ajoute chaque image sous le champ media, dans l’ordre', () => {
    const form = buildDesignForm({
      uris: ['file:///a.jpg', 'file:///b.png'],
      title: 'Carrousel',
      category: 'ENSEMBLE',
      description: 'desc',
    });
    const parts = entries(form);
    const mediaParts = parts.filter(([k]) => k === 'media');
    expect(mediaParts).toHaveLength(2);
    expect(parts.some(([k, v]) => k === 'title' && v === 'Carrousel')).toBe(true);
    expect(parts.some(([k, v]) => k === 'category' && v === 'ENSEMBLE')).toBe(true);
    expect(parts.some(([k, v]) => k === 'description' && v === 'desc')).toBe(true);
  });

  it('omet la description vide', () => {
    const form = buildDesignForm({ uris: ['file:///a.jpg'], title: 'T', category: 'ROBE' });
    const parts = entries(form);
    expect(parts.some(([k]) => k === 'description')).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd apps/mobile && npx jest src/designs/buildDesignForm.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `buildDesignForm`**

```typescript
// apps/mobile/src/designs/buildDesignForm.ts
import type { DesignCategory } from '@moodly/shared';

export type PublishInput = {
  uris: string[];
  title: string;
  category: DesignCategory;
  description?: string;
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
  for (const uri of input.uris) {
    form.append('media', fileFromUri(uri) as unknown as Blob);
  }
  return form;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd apps/mobile && npx jest src/designs/buildDesignForm.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Câbler le hook sur `buildDesignForm`**

Dans `apps/mobile/src/designs/hooks.ts`, remplacer le type `PublishInput` local et le corps de `usePublishDesign` par l'usage du builder :

```typescript
import { buildDesignForm, type PublishInput } from './buildDesignForm';
```

```typescript
export function usePublishDesign() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: PublishInput) => apiUpload<{ design: Design }>('/designs', buildDesignForm(input), token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
  return {
    publish: (input: PublishInput) => m.mutateAsync(input),
    publishing: m.isPending,
  };
}
```

(Supprimer l'ancien `type PublishInput = { uri: string; … }` local et l'ancienne construction de `FormData`.)

- [ ] **Step 6: Mettre à jour l'écran `publish.tsx` (sélection 1 à 5 images)**

Changements dans `apps/mobile/app/publish.tsx` :

Remplacer l'état `uri` par une liste :

```tsx
  const [uris, setUris] = useState<string[]>([]);
```

Sélection multiple (jusqu'à 5) :

```tsx
  async function pickImages() {
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
```

Soumission :

```tsx
  async function submit() {
    setError(null);
    if (uris.length === 0) return setError('Ajoute au moins une photo du modèle.');
    if (title.trim().length === 0) return setError('Donne un titre à ton modèle.');
    if (!category) return setError('Choisis une catégorie.');
    try {
      await publish({ uris, title: title.trim(), category, description: description.trim() || undefined });
      router.replace('/(tabs)/profile');
    } catch {
      setError('La publication a échoué. Réessaie.');
    }
  }
```

Zone de sélection : afficher la 1re image en aperçu + une rangée de miniatures des autres, avec un compteur « n/5 ». Remplacer le bloc `<Pressable style={styles.picker} …>` par :

```tsx
        <Pressable style={styles.picker} onPress={pickImages}>
          {uris.length > 0 ? (
            <Image source={{ uri: uris[0] }} style={styles.preview} contentFit="cover" />
          ) : (
            <View style={styles.pickerEmpty}>
              <Feather name="camera" size={28} color={colors.accent} />
              <Text style={styles.pickerText}>Ajouter des photos (jusqu’à 5)</Text>
            </View>
          )}
        </Pressable>
        {uris.length > 1 ? (
          <View style={styles.thumbs}>
            {uris.map((u, i) => (
              <Image key={u + i} source={{ uri: u }} style={styles.thumb} contentFit="cover" />
            ))}
          </View>
        ) : null}
```

Ajouter les styles `thumbs` et `thumb` au `StyleSheet` :

```tsx
  thumbs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' },
  thumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.inkElevated },
```

(`router.replace('/(tabs)/profile')` : depuis le bloc D, le portfolio vit dans le profil ; on redirige vers le profil au lieu de `/(tabs)/portfolio` qui n'est plus un onglet.)

- [ ] **Step 7: Typecheck + suite mobile complète**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean ; toute la suite verte.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/designs/hooks.ts apps/mobile/src/designs/buildDesignForm.ts apps/mobile/src/designs/buildDesignForm.test.ts apps/mobile/app/publish.tsx
git commit -m "feat(mobile): publication de 1 à 5 images (multipart media[])"
```

---

### Task 10: Vérification finale (backfill dev + suites + bundle + revue manuelle)

**Files:** aucun (validation).

- [ ] **Step 1: Appliquer le backfill sur la base de dev (42 démos)**

Run: `cd apps/api && npx tsx scripts/backfill-media.mjs`
Expected: `Backfill média : N design(s) traité(s).` (N ≈ 42). Les modèles de démo ont désormais 1 `Media` + un `coverBlurhash`.

- [ ] **Step 2: Suites complètes + typecheck (API + mobile)**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: typecheck clean ; **API ≥ 86 + nouveaux tests** verts.

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: typecheck clean ; **mobile ≥ 36 + nouveaux tests** verts.

- [ ] **Step 3: Bundle de production mobile**

Run: `cd apps/mobile && npx expo export --platform ios --output-dir /tmp/moodly-export-blocA`
Expected: export réussi.

- [ ] **Step 4: Revue manuelle sur appareil (Expo Go)**

API `npm run dev` (apps/api) + `npx expo start --host lan -c` (apps/mobile), scan QR. Vérifier :
- **Feed** : les cartes chargent avec un **flou (blurhash) → net** ; les modèles à plusieurs images portent le **badge multi-média** en haut à droite.
- **Publication** (tailleur `+221770009999` / `secret123`, onglet ⊕ Publier) : sélectionner **plusieurs images** (jusqu'à 5), publier → le nouveau modèle apparaît au feed avec le badge multi-média.

- [ ] **Step 5: Nettoyer l'export temporaire**

```bash
rm -rf /tmp/moodly-export-blocA
```

---

## Notes d'implémentation

- **Pas de rendu carrousel/vidéo** dans ce bloc : `media[]` est renvoyé et stocké, mais seul le feed (cover + badge) l'utilise visuellement. Le carrousel swipeable arrive au **bloc D**.
- **Champ multipart** : l'ancien nom `image` devient `media` (API Task 4 + mobile Task 9). S'assurer que tout test/consommateur qui référençait `image` est mis à jour (Task 4 Step 5).
- **Rétro-compat cover** : `Design.imageUrl/imageWidth/imageHeight` restent la cover — aucun écran existant qui lit `design.imageUrl` ne casse.
- **Blurhash null toléré** : un design sans fichier lisible garde `coverBlurhash = null` → `DesignCard` n'applique simplement pas de placeholder (fond `inkElevated`).
