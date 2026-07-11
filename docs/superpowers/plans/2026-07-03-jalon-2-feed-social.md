# Jalon 2 — API Feed & Social : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire toute l'API communauté de Moodly : publication de modèles avec image, feed paginé/filtré/recherché, likes, sauvegardes, commentaires, follows, profil public tailleur.

**Architecture:** Extension de `apps/api` (Express 5 + Prisma). Nouveaux modèles `Design`, `Like`, `Bookmark`, `Comment`, `Follow` avec compteurs dénormalisés sur `Design` maintenus en transaction. Stockage d'images derrière une interface `ImageStorage` : driver Cloudinary si `CLOUDINARY_URL` est défini, sinon disque local servi statiquement sous `/uploads`. Réactions (like/bookmark) idempotentes pour tolérer les retries en réseau faible.

**Tech Stack:** existant (Express 5, Prisma 6, zod, Vitest+Supertest) + `multer` (upload multipart), `sharp` (dimensions + compression), `cloudinary` (driver optionnel).

**Spec:** `docs/superpowers/specs/2026-07-03-moodly-mvp-design.md` (sections Communauté, Profils, API)
**Prérequis:** Jalon 1 terminé (branche `jalon-1-fondations-auth`, 20 tests verts).

## Global Constraints

- TypeScript `strict: true`, ESM, imports relatifs avec extension `.js`.
- Erreurs : `{ error: { code, message } }`, codes MAJUSCULES_FRANCAISES, messages français simples.
- Catégories de modèles : les 8 de `@moodly/shared` (`BOUBOU`, `ROBE`, `ENSEMBLE`, `ENFANT`, `MARIAGE`, `TABASKI`, `KORITE`, `MAGAL`).
- Toute route d'écriture exige le JWT (`requireAuth`) ; publication/gestion de modèles réservée au rôle `TAILLEUR` ; le feed et les profils publics se lisent SANS compte (exigence « facile comme TikTok »).
- Likes, bookmarks et follows sont **idempotents** : POST déjà fait → 204 sans double comptage ; DELETE inexistant → 204.
- Compteurs `likesCount`/`commentsCount`/`bookmarksCount` mis à jour dans la même `$transaction` que l'écriture.
- Ne jamais renvoyer `passwordHash` ni `phone` d'un AUTRE utilisateur (le téléphone est privé ; seuls `id`, `name`, `avatarUrl` sont publics).
- Images : multipart champ `image`, max 5 Mo, types `image/jpeg|png|webp` uniquement.
- Commits en français, préfixes `feat:`/`fix:`/`test:`/`chore:`.
- Tous les chemins relatifs à `/Users/macbook_1/devperso/Moodly`. Suite : `npm test -w apps/api` (base : 18 tests API verts + 2 shared).

---

### Task 1: Durcissement reporté du jalon 1

**Files:**
- Modify: `apps/api/src/middleware/auth.ts`
- Modify: `apps/api/tests/me.test.ts`
- Modify: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `ApiError` existants.
- Produces: `requireRole` renvoie 401 `NON_AUTHENTIFIE` si `req.user` est absent (utilisé sans `requireAuth`) au lieu de 403. Comportement inchangé sinon.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `apps/api/tests/me.test.ts`, ajouter au `describe('requireRole', ...)` existant (qui contient déjà la fabrique `miniApp()`) :

```ts
  it('renvoie 401 NON_AUTHENTIFIE si requireRole est utilisé sans requireAuth', async () => {
    const mini = express();
    mini.get('/oubli-auth', requireRole('TAILLEUR'), (_req, res) => {
      res.json({ ok: true });
    });
    mini.use(errorHandler);
    const res = await request(mini).get('/oubli-auth');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NON_AUTHENTIFIE');
  });
```

Dans `apps/api/tests/auth.test.ts`, dans le test existant `'connecte un utilisateur inscrit'` du `describe('POST /auth/login', ...)`, ajouter après les assertions existantes :

```ts
    expect(res.body.user.passwordHash).toBeUndefined();
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -w apps/api`
Expected: le nouveau test `requireRole sans requireAuth` échoue (reçoit 403 `ACCES_REFUSE` au lieu de 401). L'assertion login passe déjà (elle documente le contrat) — c'est attendu.

- [ ] **Step 3: Implémenter le guard**

Dans `apps/api/src/middleware/auth.ts`, remplacer le corps de `requireRole` :

```ts
export function requireRole(role: 'TAILLEUR' | 'CLIENT') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'NON_AUTHENTIFIE', 'Connexion requise.');
    }
    if (req.user.role !== role) {
      throw new ApiError(403, 'ACCES_REFUSE', 'Tu n’as pas accès à cette action.');
    }
    next();
  };
}
```

- [ ] **Step 4: Vérifier le vert**

Run: `npm test -w apps/api`
Expected: PASS (20 tests API).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "fix: requireRole rend 401 sans requireAuth + assertion no-passwordHash au login"
```

---

### Task 2: Modèles Prisma communauté + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration via `prisma migrate dev`
- Test: `apps/api/tests/community-models.test.ts`

**Interfaces:**
- Consumes: modèles `User`/`TailorProfile` existants.
- Produces: modèles Prisma `Design` (compteurs `likesCount`/`commentsCount`/`bookmarksCount`, champs `imageUrl`/`imageWidth`/`imageHeight`, enum `DesignCategory`), `Like`, `Bookmark` (uniques sur `[userId, designId]`), `Comment`, `Follow` (unique sur `[followerId, tailorId]`, index nommé `followerId_tailorId`). Relations inverses sur `User` : `designs`, `likes`, `bookmarks`, `comments`, `following`, `followers`.

- [ ] **Step 1: Étendre le schéma**

Dans `apps/api/prisma/schema.prisma`, ajouter au modèle `User` (dans le bloc existant, après `tailorProfile`) :

```prisma
  designs   Design[]
  likes     Like[]
  bookmarks Bookmark[]
  comments  Comment[]
  following Follow[]   @relation("following")
  followers Follow[]   @relation("followers")
```

Puis ajouter en fin de fichier :

```prisma
enum DesignCategory {
  BOUBOU
  ROBE
  ENSEMBLE
  ENFANT
  MARIAGE
  TABASKI
  KORITE
  MAGAL
}

model Design {
  id             String         @id @default(cuid())
  tailorId       String
  tailor         User           @relation(fields: [tailorId], references: [id], onDelete: Cascade)
  title          String
  description    String?
  category       DesignCategory
  imageUrl       String
  imageWidth     Int
  imageHeight    Int
  likesCount     Int            @default(0)
  commentsCount  Int            @default(0)
  bookmarksCount Int            @default(0)
  createdAt      DateTime       @default(now())
  likes          Like[]
  bookmarks      Bookmark[]
  comments       Comment[]

  @@index([category])
  @@index([tailorId])
  @@map("designs")
}

model Like {
  id        String   @id @default(cuid())
  userId    String
  designId  String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  design    Design   @relation(fields: [designId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, designId])
  @@map("likes")
}

model Bookmark {
  id        String   @id @default(cuid())
  userId    String
  designId  String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  design    Design   @relation(fields: [designId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, designId])
  @@map("bookmarks")
}

model Comment {
  id        String   @id @default(cuid())
  userId    String
  designId  String
  text      String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  design    Design   @relation(fields: [designId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([designId])
  @@map("comments")
}

model Follow {
  id         String   @id @default(cuid())
  followerId String
  tailorId   String
  follower   User     @relation("following", fields: [followerId], references: [id], onDelete: Cascade)
  tailor     User     @relation("followers", fields: [tailorId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([followerId, tailorId])
  @@map("follows")
}
```

- [ ] **Step 2: Migrer**

Run: `cd apps/api && npx prisma migrate dev --name jalon2_communaute && cd ../..`
Expected: `Your database is now in sync with your schema.`

- [ ] **Step 3: Test d'infrastructure**

`apps/api/tests/community-models.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

async function createTailor(phone: string) {
  return prisma.user.create({
    data: { phone, passwordHash: 'x', name: 'Mamadou', role: 'TAILLEUR' },
  });
}

describe('modèles communauté', () => {
  it('crée un modèle avec image et compteurs à zéro', async () => {
    const tailor = await createTailor('+221770000100');
    const design = await prisma.design.create({
      data: {
        tailorId: tailor.id,
        title: 'Boubou brodé',
        category: 'BOUBOU',
        imageUrl: 'http://localhost:3000/uploads/x.webp',
        imageWidth: 600,
        imageHeight: 800,
      },
    });
    expect(design.likesCount).toBe(0);
    expect(design.commentsCount).toBe(0);
    expect(design.bookmarksCount).toBe(0);
  });

  it('interdit deux likes du même utilisateur sur le même modèle', async () => {
    const tailor = await createTailor('+221770000101');
    const design = await prisma.design.create({
      data: {
        tailorId: tailor.id,
        title: 'Robe wax',
        category: 'ROBE',
        imageUrl: 'http://localhost:3000/uploads/y.webp',
        imageWidth: 600,
        imageHeight: 800,
      },
    });
    await prisma.like.create({ data: { userId: tailor.id, designId: design.id } });
    await expect(
      prisma.like.create({ data: { userId: tailor.id, designId: design.id } }),
    ).rejects.toThrow();
  });

  it('supprime en cascade likes et modèles quand le tailleur est supprimé', async () => {
    const tailor = await createTailor('+221770000102');
    const design = await prisma.design.create({
      data: {
        tailorId: tailor.id,
        title: 'Ensemble',
        category: 'ENSEMBLE',
        imageUrl: 'http://localhost:3000/uploads/z.webp',
        imageWidth: 600,
        imageHeight: 800,
      },
    });
    await prisma.like.create({ data: { userId: tailor.id, designId: design.id } });
    await prisma.user.delete({ where: { id: tailor.id } });
    expect(await prisma.design.findUnique({ where: { id: design.id } })).toBeNull();
    expect(await prisma.like.count()).toBe(0);
  });
});
```

Run: `npm test -w apps/api`
Expected: PASS — test d'infrastructure (pas de TDD strict : le schéma est déjà migré).

- [ ] **Step 4: Commit**

```bash
git add apps/api
git commit -m "feat: modèles communauté (Design, Like, Bookmark, Comment, Follow) + migration"
```

---

### Task 3: Stockage d'images (local + Cloudinary) et upload

**Files:**
- Create: `apps/api/src/lib/storage.ts`
- Modify: `apps/api/src/lib/errors.ts` (branche MulterError)
- Modify: `apps/api/src/app.ts` (servir `/uploads` en statique)
- Modify: `apps/api/.env.example`, `apps/api/.env.test`, `.gitignore`
- Create: `apps/api/tests/helpers.ts`
- Test: `apps/api/tests/storage.test.ts`

**Interfaces:**
- Consumes: `ApiError`.
- Produces:
  - `type StoredImage = { url: string; width: number; height: number }`
  - `interface ImageStorage { save(buffer: Buffer): Promise<StoredImage> }`
  - `storage: ImageStorage` (singleton exporté par `src/lib/storage.ts` : Cloudinary si `process.env.CLOUDINARY_URL`, sinon disque local dans `process.env.UPLOADS_DIR ?? './uploads'`, URL `${PUBLIC_BASE_URL ?? 'http://localhost:3000'}/uploads/<nom>.webp`)
  - Helpers de test dans `tests/helpers.ts` : `registerUser(app, role, phone)` → `{ token, user }` et `makeTestImage(width?, height?)` → `Buffer` JPEG.
  - `errorHandler` mappe les erreurs Multer (`err.name === 'MulterError'`) sur 400 `FICHIER_INVALIDE`.

- [ ] **Step 1: Installer les dépendances**

```bash
npm install multer sharp cloudinary -w apps/api
npm install -D @types/multer -w apps/api
```

- [ ] **Step 2: Écrire le test qui échoue**

`apps/api/tests/helpers.ts` :

```ts
import type { Express } from 'express';
import request from 'supertest';
import sharp from 'sharp';

export async function registerUser(
  app: Express,
  role: 'TAILLEUR' | 'CLIENT',
  phone: string,
) {
  const res = await request(app).post('/auth/register').send({
    phone,
    password: 'secret123',
    name: role === 'TAILLEUR' ? 'Mamadou' : 'Fatou',
    role,
  });
  if (res.status !== 201) {
    throw new Error(`registerUser a échoué : ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.accessToken as string, user: res.body.user as { id: string; name: string } };
}

export async function makeTestImage(width = 600, height = 800): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 210, g: 105, b: 30 } },
  })
    .jpeg()
    .toBuffer();
}
```

`apps/api/tests/storage.test.ts` :

```ts
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { storage } from '../src/lib/storage.js';
import { makeTestImage } from './helpers.js';

describe('stockage local des images', () => {
  it('sauvegarde une image et renvoie url + dimensions', async () => {
    const buffer = await makeTestImage(600, 800);
    const stored = await storage.save(buffer);
    expect(stored.width).toBe(600);
    expect(stored.height).toBe(800);
    expect(stored.url).toMatch(/\/uploads\/[\w-]+\.webp$/);
    const fileName = stored.url.split('/uploads/')[1];
    expect(existsSync(path.join(process.env.UPLOADS_DIR ?? './uploads', fileName))).toBe(true);
  });

  it('rejette un buffer qui n’est pas une image', async () => {
    await expect(storage.save(Buffer.from('pas une image'))).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Vérifier l'échec**

Run: `npm test -w apps/api`
Expected: FAIL — `Cannot find module '../src/lib/storage.js'`.

- [ ] **Step 4: Implémenter le stockage**

`apps/api/src/lib/storage.ts` :

```ts
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { ApiError } from './errors.js';

export type StoredImage = { url: string; width: number; height: number };

export interface ImageStorage {
  save(buffer: Buffer): Promise<StoredImage>;
}

class LocalDiskStorage implements ImageStorage {
  constructor(
    private baseUrl: string,
    private dir: string,
  ) {}

  async save(buffer: Buffer): Promise<StoredImage> {
    let width: number | undefined;
    let height: number | undefined;
    let webp: Buffer;
    try {
      const image = sharp(buffer);
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
    return { url: `${this.baseUrl}/uploads/${fileName}`, width, height };
  }
}

class CloudinaryStorage implements ImageStorage {
  async save(buffer: Buffer): Promise<StoredImage> {
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
    return { url: result.secure_url, width: result.width, height: result.height };
  }
}

function createStorage(): ImageStorage {
  if (process.env.CLOUDINARY_URL) {
    return new CloudinaryStorage();
  }
  const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const dir = path.resolve(process.env.UPLOADS_DIR ?? './uploads');
  return new LocalDiskStorage(baseUrl, dir);
}

export const storage: ImageStorage = createStorage();
```

Dans `apps/api/src/lib/errors.ts`, dans `errorHandler`, ajouter AVANT le `console.error(err)` :

```ts
  if (err instanceof Error && err.name === 'MulterError') {
    res.status(400).json({
      error: {
        code: 'FICHIER_INVALIDE',
        message: 'Fichier trop volumineux (5 Mo max) ou champ inattendu.',
      },
    });
    return;
  }
```

Dans `apps/api/src/app.ts`, après `app.use(express.json(...))` :

```ts
import path from 'node:path';
// ...
  app.use(
    '/uploads',
    express.static(path.resolve(process.env.UPLOADS_DIR ?? './uploads')),
  );
```

Ajouter à `apps/api/.env.example` (en commentaire, avec les lignes existantes conservées) :

```
# Optionnel : active le stockage Cloudinary (sinon disque local ./uploads)
# CLOUDINARY_URL="cloudinary://key:secret@cloud-name"
# PUBLIC_BASE_URL="http://localhost:3000"
```

Ajouter à `apps/api/.env.test` :

```
UPLOADS_DIR="./test-uploads"
```

Ajouter à `.gitignore` (racine) :

```
uploads/
test-uploads/
```

- [ ] **Step 5: Vérifier le vert**

Run: `npm test -w apps/api`
Expected: PASS (2 nouveaux tests storage + les existants).

- [ ] **Step 6: Commit**

```bash
git add apps/api .gitignore package-lock.json
git commit -m "feat: stockage d'images (disque local + driver Cloudinary optionnel)"
```

---

### Task 4: POST /designs + GET /designs/:id

**Files:**
- Create: `apps/api/src/modules/designs/designs.service.ts`
- Create: `apps/api/src/modules/designs/designs.routes.ts`
- Modify: `apps/api/src/app.ts` (monter `designsRouter` sur `/designs`, avant le 404)
- Modify: `apps/api/src/middleware/auth.ts` (ajouter `optionalAuth`)
- Test: `apps/api/tests/designs.test.ts`

**Interfaces:**
- Consumes: `storage`, `requireAuth`, `requireRole`, `prisma`, `ApiError`, `DESIGN_CATEGORIES` de `@moodly/shared`, helpers de test.
- Produces:
  - `optionalAuth` (middleware : pose `req.user` si un Bearer token valide est présent, sinon continue en anonyme).
  - `designsRouter` monté sur `/designs`.
  - `POST /designs` (TAILLEUR, multipart : champ fichier `image` + champs texte `title`, `description?`, `category`) → 201 `{ design }`.
  - `GET /designs/:id` → 200 `{ design, comments }` (commentaires les 50 plus récents, plus ancien d'abord) ; 404 `INTROUVABLE`.
  - `designs.service.ts` exporte `designInclude(viewerId: string)` (include Prisma : `tailor` sélection publique + `likes`/`bookmarks` filtrés sur le viewer) et `toApiDesign(design)` (sérialiseur : compteurs, `likedByMe`, `bookmarkedByMe`, tailleur public `{ id, name, avatarUrl }`) — réutilisés par les tâches 5, 6 et 8.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/designs.test.ts` :

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

async function publishDesign(token: string, overrides: Record<string, string> = {}) {
  const req = request(app)
    .post('/designs')
    .set('Authorization', `Bearer ${token}`)
    .field('title', overrides.title ?? 'Boubou brodé or')
    .field('category', overrides.category ?? 'BOUBOU')
    .attach('image', await makeTestImage(), 'modele.jpg');
  if (overrides.description) req.field('description', overrides.description);
  return req;
}

describe('POST /designs', () => {
  it('publie un modèle avec image (tailleur)', async () => {
    const { token, user } = await registerUser(app, 'TAILLEUR', '+221770001001');
    const res = await publishDesign(token, { description: 'Bazin riche, broderie main' });
    expect(res.status).toBe(201);
    expect(res.body.design).toMatchObject({
      title: 'Boubou brodé or',
      category: 'BOUBOU',
      description: 'Bazin riche, broderie main',
      likesCount: 0,
      likedByMe: false,
      tailor: { id: user.id, name: 'Mamadou' },
    });
    expect(res.body.design.imageUrl).toMatch(/\/uploads\/.+\.webp$/);
    expect(res.body.design.imageWidth).toBe(600);
    expect(res.body.design.imageHeight).toBe(800);
  });

  it('refuse un client (403)', async () => {
    const { token } = await registerUser(app, 'CLIENT', '+221770001002');
    const res = await publishDesign(token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCES_REFUSE');
  });

  it('refuse sans image (400 IMAGE_REQUISE)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770001003');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Sans photo')
      .field('category', 'ROBE');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMAGE_REQUISE');
  });

  it('refuse une catégorie inconnue (400)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770001004');
    const res = await publishDesign(token, { category: 'PYJAMA' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });

  it('refuse un fichier qui n’est pas une image (400)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770001005');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Faux fichier')
      .field('category', 'ROBE')
      .attach('image', Buffer.from('pas une image'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FORMAT_IMAGE_INVALIDE');
  });
});

describe('GET /designs/:id', () => {
  it('renvoie le détail sans authentification', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770001006');
    const created = await publishDesign(token);
    const res = await request(app).get(`/designs/${created.body.design.id}`);
    expect(res.status).toBe(200);
    expect(res.body.design.title).toBe('Boubou brodé or');
    expect(res.body.design.likedByMe).toBe(false);
    expect(res.body.comments).toEqual([]);
  });

  it('renvoie 404 pour un id inconnu', async () => {
    const res = await request(app).get('/designs/inexistant123');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INTROUVABLE');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -w apps/api`
Expected: FAIL — les nouveaux tests échouent en 404 (router non monté).

- [ ] **Step 3: Implémenter**

Dans `apps/api/src/middleware/auth.ts`, ajouter :

```ts
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(header.slice('Bearer '.length));
    } catch {
      // Token absent ou invalide : on continue en anonyme.
    }
  }
  next();
}
```

`apps/api/src/modules/designs/designs.service.ts` :

```ts
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export const publicUserSelect = { id: true, name: true, avatarUrl: true } as const;

export function designInclude(viewerId: string) {
  return {
    tailor: { select: publicUserSelect },
    likes: { where: { userId: viewerId }, select: { id: true } },
    bookmarks: { where: { userId: viewerId }, select: { id: true } },
  } as const;
}

type DesignWithViewer = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
  createdAt: Date;
  tailor: { id: string; name: string; avatarUrl: string | null };
  likes: { id: string }[];
  bookmarks: { id: string }[];
};

export function toApiDesign(design: DesignWithViewer) {
  const { likes, bookmarks, ...rest } = design;
  return { ...rest, likedByMe: likes.length > 0, bookmarkedByMe: bookmarks.length > 0 };
}

export async function ensureDesignExists(designId: string): Promise<void> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: { id: true },
  });
  if (!design) {
    throw new ApiError(404, 'INTROUVABLE', 'Modèle introuvable.');
  }
}
```

`apps/api/src/modules/designs/designs.routes.ts` :

```ts
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { DESIGN_CATEGORIES } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { designInclude, toApiDesign } from './designs.service.js';

export const designsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const createDesignSchema = z.object({
  title: z.string().min(1, 'Le titre est requis.').max(120),
  description: z.string().max(1000).optional(),
  category: z.enum(DESIGN_CATEGORIES),
});

designsRouter.post(
  '/',
  requireAuth,
  requireRole('TAILLEUR'),
  upload.single('image'),
  async (req, res) => {
    const parsed = createDesignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
    }
    if (!req.file) {
      throw new ApiError(400, 'IMAGE_REQUISE', 'Une photo du modèle est requise.');
    }
    if (!ALLOWED_MIMES.includes(req.file.mimetype)) {
      throw new ApiError(
        400,
        'FORMAT_IMAGE_INVALIDE',
        'Formats acceptés : JPEG, PNG ou WebP.',
      );
    }
    const image = await storage.save(req.file.buffer);
    const design = await prisma.design.create({
      data: {
        tailorId: req.user!.sub,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        imageUrl: image.url,
        imageWidth: image.width,
        imageHeight: image.height,
      },
      include: designInclude(req.user!.sub),
    });
    res.status(201).json({ design: toApiDesign(design) });
  },
);

designsRouter.get('/:id', optionalAuth, async (req, res) => {
  const viewerId = req.user?.sub ?? '';
  const design = await prisma.design.findUnique({
    where: { id: req.params.id },
    include: designInclude(viewerId),
  });
  if (!design) {
    throw new ApiError(404, 'INTROUVABLE', 'Modèle introuvable.');
  }
  const comments = await prisma.comment.findMany({
    where: { designId: design.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json({ design: toApiDesign(design), comments: comments.reverse() });
});
```

Dans `apps/api/src/app.ts`, monter avant le 404 :

```ts
import { designsRouter } from './modules/designs/designs.routes.js';
// ...
app.use('/designs', designsRouter);
```

- [ ] **Step 4: Vérifier le vert**

Run: `npm test -w apps/api`
Expected: PASS (7 nouveaux tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: publication de modèles avec image + détail public (POST/GET /designs)"
```

---

### Task 5: GET /designs — feed paginé, filtres, recherche, tri

**Files:**
- Modify: `apps/api/src/modules/designs/designs.routes.ts`
- Test: `apps/api/tests/feed.test.ts`

**Interfaces:**
- Consumes: `designInclude`, `toApiDesign`, `optionalAuth`.
- Produces: `GET /designs?category=&search=&sort=recent|tendance&page=1&limit=20` → 200 `{ designs, page, hasMore }`. Public (viewer anonyme : `likedByMe: false`). `search` filtre titre OU description (insensible à la casse). `tendance` trie par `likesCount` décroissant puis id décroissant ; `recent` (défaut) par id décroissant.

**IMPORTANT — ordre des routes Express :** la route `GET /` doit être déclarée AVANT `GET /:id` dans le fichier ou sur des chemins non ambigus (Express distingue `/` et `/:id`, pas de conflit réel — déclarer `GET /` au-dessus de `GET /:id` par lisibilité).

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/feed.test.ts` :

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function seedDesigns(tailorId: string) {
  // Insertion directe en base : plus rapide que 25 uploads multipart.
  const rows = Array.from({ length: 25 }, (_, i) => ({
    tailorId,
    title: i % 2 === 0 ? `Boubou tabaski ${i}` : `Robe soirée ${i}`,
    category: (i % 2 === 0 ? 'TABASKI' : 'ROBE') as 'TABASKI' | 'ROBE',
    imageUrl: `http://localhost:3000/uploads/seed-${i}.webp`,
    imageWidth: 600,
    imageHeight: 800,
    likesCount: i === 3 ? 99 : 0,
  }));
  await prisma.design.createMany({ data: rows });
}

describe('GET /designs (feed)', () => {
  let tailorId: string;

  beforeEach(async () => {
    const { user } = await registerUser(app, 'TAILLEUR', '+221770002001');
    tailorId = user.id;
    await seedDesigns(tailorId);
  });

  it('pagine le feed sans authentification (20 par défaut, hasMore)', async () => {
    const res = await request(app).get('/designs');
    expect(res.status).toBe(200);
    expect(res.body.designs).toHaveLength(20);
    expect(res.body.page).toBe(1);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.designs[0].likedByMe).toBe(false);
    expect(res.body.designs[0].tailor.id).toBe(tailorId);
  });

  it('renvoie la page 2 avec hasMore=false', async () => {
    const res = await request(app).get('/designs?page=2');
    expect(res.status).toBe(200);
    expect(res.body.designs).toHaveLength(5);
    expect(res.body.hasMore).toBe(false);
  });

  it('filtre par catégorie', async () => {
    const res = await request(app).get('/designs?category=TABASKI&limit=50');
    expect(res.status).toBe(200);
    expect(res.body.designs).toHaveLength(13);
    for (const d of res.body.designs) expect(d.category).toBe('TABASKI');
  });

  it('recherche dans le titre (insensible à la casse)', async () => {
    const res = await request(app).get('/designs?search=ROBE%20SOIR&limit=50');
    expect(res.status).toBe(200);
    expect(res.body.designs.length).toBeGreaterThan(0);
    for (const d of res.body.designs) expect(d.title.toLowerCase()).toContain('robe soir');
  });

  it('trie par tendance (le plus liké en premier)', async () => {
    const res = await request(app).get('/designs?sort=tendance');
    expect(res.status).toBe(200);
    expect(res.body.designs[0].likesCount).toBe(99);
  });

  it('rejette une catégorie invalide (400)', async () => {
    const res = await request(app).get('/designs?category=PYJAMA');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -w apps/api`
Expected: FAIL — `GET /designs` renvoie 404 (seule `GET /designs/:id` existe ; Express ne matche pas `/` sur `/:id`).

- [ ] **Step 3: Implémenter le feed**

Dans `apps/api/src/modules/designs/designs.routes.ts`, ajouter AVANT `designsRouter.get('/:id', ...)` :

```ts
const feedQuerySchema = z.object({
  category: z.enum(DESIGN_CATEGORIES).optional(),
  search: z.string().min(1).max(80).optional(),
  sort: z.enum(['recent', 'tendance']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

designsRouter.get('/', optionalAuth, async (req, res) => {
  const parsed = feedQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const { category, search, sort, page, limit } = parsed.data;
  const viewerId = req.user?.sub ?? '';
  const where = {
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
  const orderBy =
    sort === 'tendance'
      ? [{ likesCount: 'desc' as const }, { id: 'desc' as const }]
      : [{ id: 'desc' as const }];
  const rows = await prisma.design.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit + 1,
    include: designInclude(viewerId),
  });
  const hasMore = rows.length > limit;
  res.json({
    designs: rows.slice(0, limit).map(toApiDesign),
    page,
    hasMore,
  });
});
```

- [ ] **Step 4: Vérifier le vert**

Run: `npm test -w apps/api`
Expected: PASS (6 nouveaux tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: feed des modèles (pagination, filtres catégorie, recherche, tri tendance)"
```

---

### Task 6: Likes & sauvegardes idempotents + GET /me/bookmarks

**Files:**
- Modify: `apps/api/src/modules/designs/designs.service.ts` (réactions)
- Modify: `apps/api/src/modules/designs/designs.routes.ts` (4 routes)
- Modify: `apps/api/src/modules/users/users.routes.ts` (`GET /me/bookmarks`)
- Test: `apps/api/tests/reactions.test.ts`

**Interfaces:**
- Consumes: `ensureDesignExists`, `designInclude`, `toApiDesign`, `requireAuth`, `Prisma` (P2002).
- Produces:
  - `addReaction(kind: 'like' | 'bookmark', userId: string, designId: string): Promise<void>` et `removeReaction(kind, userId, designId): Promise<void>` dans `designs.service.ts` — idempotents, compteur en `$transaction`.
  - `POST|DELETE /designs/:id/like` et `POST|DELETE /designs/:id/bookmark` → 204 (404 si modèle inconnu).
  - `GET /me/bookmarks` → 200 `{ designs }` (les modèles sauvegardés, plus récent d'abord).

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/reactions.test.ts` :

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

let clientToken: string;
let designId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770003001');
  const client = await registerUser(app, 'CLIENT', '+221770003002');
  clientToken = client.token;
  const design = await prisma.design.create({
    data: {
      tailorId: tailor.user.id,
      title: 'Ensemble wax',
      category: 'ENSEMBLE',
      imageUrl: 'http://localhost:3000/uploads/r.webp',
      imageWidth: 600,
      imageHeight: 800,
    },
  });
  designId = design.id;
});

async function like() {
  return request(app)
    .post(`/designs/${designId}/like`)
    .set('Authorization', `Bearer ${clientToken}`);
}

describe('likes', () => {
  it('like puis unlike : compteur et likedByMe cohérents', async () => {
    expect((await like()).status).toBe(204);
    let detail = await request(app)
      .get(`/designs/${designId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(detail.body.design.likesCount).toBe(1);
    expect(detail.body.design.likedByMe).toBe(true);

    const del = await request(app)
      .delete(`/designs/${designId}/like`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(del.status).toBe(204);
    detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.likesCount).toBe(0);
  });

  it('est idempotent : double like ne compte qu’une fois', async () => {
    await like();
    expect((await like()).status).toBe(204);
    const detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.likesCount).toBe(1);
  });

  it('est idempotent : unlike sans like préalable → 204, compteur à 0', async () => {
    const del = await request(app)
      .delete(`/designs/${designId}/like`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(del.status).toBe(204);
    const detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.likesCount).toBe(0);
  });

  it('refuse sans authentification (401)', async () => {
    const res = await request(app).post(`/designs/${designId}/like`);
    expect(res.status).toBe(401);
  });

  it('404 sur un modèle inconnu', async () => {
    const res = await request(app)
      .post('/designs/inexistant/like')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(404);
  });
});

describe('bookmarks', () => {
  it('sauvegarde puis liste dans GET /me/bookmarks', async () => {
    const add = await request(app)
      .post(`/designs/${designId}/bookmark`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(add.status).toBe(204);

    const list = await request(app)
      .get('/me/bookmarks')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(list.status).toBe(200);
    expect(list.body.designs).toHaveLength(1);
    expect(list.body.designs[0].id).toBe(designId);
    expect(list.body.designs[0].bookmarkedByMe).toBe(true);

    const detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.bookmarksCount).toBe(1);
  });

  it('retire la sauvegarde', async () => {
    await request(app)
      .post(`/designs/${designId}/bookmark`)
      .set('Authorization', `Bearer ${clientToken}`);
    await request(app)
      .delete(`/designs/${designId}/bookmark`)
      .set('Authorization', `Bearer ${clientToken}`);
    const list = await request(app)
      .get('/me/bookmarks')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(list.body.designs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -w apps/api`
Expected: FAIL — 404 sur les routes like/bookmark et /me/bookmarks.

- [ ] **Step 3: Implémenter**

Dans `apps/api/src/modules/designs/designs.service.ts`, ajouter :

```ts
import { Prisma } from '@prisma/client';

type ReactionKind = 'like' | 'bookmark';

function counterData(kind: ReactionKind, delta: 1 | -1) {
  const op = delta === 1 ? { increment: 1 } : { decrement: 1 };
  return kind === 'like' ? { likesCount: op } : { bookmarksCount: op };
}

export async function addReaction(
  kind: ReactionKind,
  userId: string,
  designId: string,
): Promise<void> {
  await ensureDesignExists(designId);
  const create =
    kind === 'like'
      ? prisma.like.create({ data: { userId, designId } })
      : prisma.bookmark.create({ data: { userId, designId } });
  try {
    await prisma.$transaction([
      create,
      prisma.design.update({
        where: { id: designId },
        data: counterData(kind, 1),
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return; // Déjà fait : idempotent, pas de double comptage.
    }
    throw err;
  }
}

export async function removeReaction(
  kind: ReactionKind,
  userId: string,
  designId: string,
): Promise<void> {
  await ensureDesignExists(designId);
  const deleted =
    kind === 'like'
      ? await prisma.like.deleteMany({ where: { userId, designId } })
      : await prisma.bookmark.deleteMany({ where: { userId, designId } });
  if (deleted.count > 0) {
    await prisma.design.update({
      where: { id: designId },
      data: counterData(kind, -1),
    });
  }
}
```

Dans `apps/api/src/modules/designs/designs.routes.ts`, ajouter (imports : `addReaction`, `removeReaction`) :

```ts
designsRouter.post('/:id/like', requireAuth, async (req, res) => {
  await addReaction('like', req.user!.sub, req.params.id);
  res.status(204).send();
});

designsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  await removeReaction('like', req.user!.sub, req.params.id);
  res.status(204).send();
});

designsRouter.post('/:id/bookmark', requireAuth, async (req, res) => {
  await addReaction('bookmark', req.user!.sub, req.params.id);
  res.status(204).send();
});

designsRouter.delete('/:id/bookmark', requireAuth, async (req, res) => {
  await removeReaction('bookmark', req.user!.sub, req.params.id);
  res.status(204).send();
});
```

Dans `apps/api/src/modules/users/users.routes.ts`, ajouter (imports : `designInclude`, `toApiDesign` depuis `../designs/designs.service.js`) :

```ts
usersRouter.get('/me/bookmarks', requireAuth, async (req, res) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
    include: { design: { include: designInclude(req.user!.sub) } },
  });
  res.json({ designs: bookmarks.map((b) => toApiDesign(b.design)) });
});
```

- [ ] **Step 4: Vérifier le vert**

Run: `npm test -w apps/api`
Expected: PASS (7 nouveaux tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: likes et sauvegardes idempotents + liste des modèles sauvegardés"
```

---

### Task 7: Commentaires

**Files:**
- Modify: `apps/api/src/modules/designs/designs.service.ts` (`addComment`)
- Modify: `apps/api/src/modules/designs/designs.routes.ts` (`GET|POST /designs/:id/comments`)
- Test: `apps/api/tests/comments.test.ts`

**Interfaces:**
- Consumes: `ensureDesignExists`, `requireAuth`, `publicUserSelect`.
- Produces:
  - `addComment(userId: string, designId: string, text: string)` → commentaire créé avec `user` public inclus ; incrémente `commentsCount` en transaction.
  - `POST /designs/:id/comments` `{ text }` (auth, 1-500 caractères) → 201 `{ comment }`.
  - `GET /designs/:id/comments` (public) → 200 `{ comments }` (plus ancien d'abord, max 100).

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/comments.test.ts` :

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

let clientToken: string;
let designId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770004001');
  const client = await registerUser(app, 'CLIENT', '+221770004002');
  clientToken = client.token;
  const design = await prisma.design.create({
    data: {
      tailorId: tailor.user.id,
      title: 'Robe de mariée',
      category: 'MARIAGE',
      imageUrl: 'http://localhost:3000/uploads/c.webp',
      imageWidth: 600,
      imageHeight: 800,
    },
  });
  designId = design.id;
});

describe('commentaires', () => {
  it('commente puis liste (ordre chronologique) et incrémente le compteur', async () => {
    const post = await request(app)
      .post(`/designs/${designId}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'Magnifique, je veux le même !' });
    expect(post.status).toBe(201);
    expect(post.body.comment.text).toBe('Magnifique, je veux le même !');
    expect(post.body.comment.user.name).toBe('Fatou');

    await request(app)
      .post(`/designs/${designId}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'Quel tissu ?' });

    const list = await request(app).get(`/designs/${designId}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.comments).toHaveLength(2);
    expect(list.body.comments[0].text).toBe('Magnifique, je veux le même !');

    const detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.commentsCount).toBe(2);
  });

  it('refuse un commentaire vide (400)', async () => {
    const res = await request(app)
      .post(`/designs/${designId}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });

  it('refuse sans authentification (401)', async () => {
    const res = await request(app)
      .post(`/designs/${designId}/comments`)
      .send({ text: 'anonyme' });
    expect(res.status).toBe(401);
  });

  it('404 sur un modèle inconnu', async () => {
    const res = await request(app)
      .post('/designs/inexistant/comments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'perdu' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -w apps/api`
Expected: FAIL — 404 sur les routes comments.

- [ ] **Step 3: Implémenter**

Dans `apps/api/src/modules/designs/designs.service.ts`, ajouter :

```ts
export async function addComment(userId: string, designId: string, text: string) {
  await ensureDesignExists(designId);
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { userId, designId, text },
      include: { user: { select: publicUserSelect } },
    }),
    prisma.design.update({
      where: { id: designId },
      data: { commentsCount: { increment: 1 } },
    }),
  ]);
  return comment;
}
```

Dans `apps/api/src/modules/designs/designs.routes.ts`, ajouter (import `addComment`, et `ensureDesignExists` déjà importable) :

```ts
const commentSchema = z.object({
  text: z.string().min(1, 'Le commentaire ne peut pas être vide.').max(500),
});

designsRouter.post('/:id/comments', requireAuth, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const comment = await addComment(req.user!.sub, req.params.id, parsed.data.text);
  res.status(201).json({ comment });
});

designsRouter.get('/:id/comments', async (req, res) => {
  await ensureDesignExists(req.params.id);
  const comments = await prisma.comment.findMany({
    where: { designId: req.params.id },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json({ comments });
});
```

(Import supplémentaire dans designs.routes.ts : `ensureDesignExists` depuis `./designs.service.js`.)

- [ ] **Step 4: Vérifier le vert**

Run: `npm test -w apps/api`
Expected: PASS (4 nouveaux tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: commentaires sur les modèles (création + liste chronologique)"
```

---

### Task 8: Follows + profil public tailleur + PATCH /me/profile

**Files:**
- Create: `apps/api/src/modules/tailors/tailors.routes.ts`
- Modify: `apps/api/src/modules/users/users.routes.ts` (`PATCH /me/profile`)
- Modify: `apps/api/src/app.ts` (monter `tailorsRouter` sur `/tailors`)
- Test: `apps/api/tests/tailors.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `optionalAuth`, `prisma`, `Prisma` (P2002), `designInclude`, `toApiDesign`, `publicUserSelect`.
- Produces:
  - `POST|DELETE /tailors/:id/follow` (auth) → 204, idempotent ; 400 `ACTION_INVALIDE` si on se suit soi-même ; 404 si la cible n'est pas un tailleur.
  - `GET /tailors/:id` (public) → 200 `{ tailor, designs, followedByMe }` où `tailor = { id, name, avatarUrl, profile, followersCount, designsCount }` — jamais le téléphone.
  - `PATCH /me/profile` (TAILLEUR) `{ bio?, location?, specialties?, yearsExperience?, priceMin?, priceMax? }` → 200 `{ profile }` ; 400 si vide ou `priceMin > priceMax`.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/tailors.test.ts` :

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

let tailorToken: string;
let tailorId: string;
let clientToken: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770005001');
  const client = await registerUser(app, 'CLIENT', '+221770005002');
  tailorToken = tailor.token;
  tailorId = tailor.user.id;
  clientToken = client.token;
});

describe('follows', () => {
  it('suit puis ne suit plus un tailleur (idempotent)', async () => {
    const follow = () =>
      request(app)
        .post(`/tailors/${tailorId}/follow`)
        .set('Authorization', `Bearer ${clientToken}`);
    expect((await follow()).status).toBe(204);
    expect((await follow()).status).toBe(204);
    expect(await prisma.follow.count()).toBe(1);

    const profile = await request(app)
      .get(`/tailors/${tailorId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(profile.body.tailor.followersCount).toBe(1);
    expect(profile.body.followedByMe).toBe(true);

    const unfollow = await request(app)
      .delete(`/tailors/${tailorId}/follow`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(unfollow.status).toBe(204);
    expect(await prisma.follow.count()).toBe(0);
  });

  it('refuse de se suivre soi-même (400)', async () => {
    const res = await request(app)
      .post(`/tailors/${tailorId}/follow`)
      .set('Authorization', `Bearer ${tailorToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ACTION_INVALIDE');
  });

  it('404 si la cible n’est pas un tailleur', async () => {
    const autreClient = await registerUser(app, 'CLIENT', '+221770005003');
    const res = await request(app)
      .post(`/tailors/${autreClient.user.id}/follow`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /tailors/:id', () => {
  it('renvoie le profil public sans authentification, sans téléphone', async () => {
    await prisma.design.create({
      data: {
        tailorId,
        title: 'Boubou du profil',
        category: 'BOUBOU',
        imageUrl: 'http://localhost:3000/uploads/p.webp',
        imageWidth: 600,
        imageHeight: 800,
      },
    });
    const res = await request(app).get(`/tailors/${tailorId}`);
    expect(res.status).toBe(200);
    expect(res.body.tailor.name).toBe('Mamadou');
    expect(res.body.tailor.phone).toBeUndefined();
    expect(res.body.tailor.designsCount).toBe(1);
    expect(res.body.tailor.profile.verified).toBe(false);
    expect(res.body.designs).toHaveLength(1);
    expect(res.body.followedByMe).toBe(false);
  });

  it('404 pour un client ou un id inconnu', async () => {
    const client = await registerUser(app, 'CLIENT', '+221770005004');
    expect((await request(app).get(`/tailors/${client.user.id}`)).status).toBe(404);
    expect((await request(app).get('/tailors/inexistant')).status).toBe(404);
  });
});

describe('PATCH /me/profile', () => {
  it('met à jour le profil du tailleur', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${tailorToken}`)
      .send({
        bio: 'Tailleur depuis 12 ans au marché HLM',
        location: 'Dakar — HLM',
        specialties: ['boubou', 'mariage'],
        yearsExperience: 12,
        priceMin: 5000,
        priceMax: 50000,
      });
    expect(res.status).toBe(200);
    expect(res.body.profile.location).toBe('Dakar — HLM');
    expect(res.body.profile.specialties).toEqual(['boubou', 'mariage']);
  });

  it('refuse un client (403)', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ bio: 'x' });
    expect(res.status).toBe(403);
  });

  it('refuse priceMin > priceMax (400)', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${tailorToken}`)
      .send({ priceMin: 9000, priceMax: 100 });
    expect(res.status).toBe(400);
  });

  it('refuse un corps vide (400)', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${tailorToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -w apps/api`
Expected: FAIL — 404 sur /tailors/* et PATCH /me/profile.

- [ ] **Step 3: Implémenter**

`apps/api/src/modules/tailors/tailors.routes.ts` :

```ts
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { designInclude, toApiDesign } from '../designs/designs.service.js';

export const tailorsRouter = Router();

async function ensureTailorExists(tailorId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: tailorId },
    select: { role: true },
  });
  if (!target || target.role !== 'TAILLEUR') {
    throw new ApiError(404, 'INTROUVABLE', 'Tailleur introuvable.');
  }
}

tailorsRouter.post('/:id/follow', requireAuth, async (req, res) => {
  const tailorId = req.params.id;
  if (tailorId === req.user!.sub) {
    throw new ApiError(400, 'ACTION_INVALIDE', 'Tu ne peux pas te suivre toi-même.');
  }
  await ensureTailorExists(tailorId);
  try {
    await prisma.follow.create({ data: { followerId: req.user!.sub, tailorId } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
      throw err;
    }
    // Déjà suivi : idempotent.
  }
  res.status(204).send();
});

tailorsRouter.delete('/:id/follow', requireAuth, async (req, res) => {
  await ensureTailorExists(req.params.id);
  await prisma.follow.deleteMany({
    where: { followerId: req.user!.sub, tailorId: req.params.id },
  });
  res.status(204).send();
});

tailorsRouter.get('/:id', optionalAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      tailorProfile: true,
      _count: { select: { followers: true, designs: true } },
    },
  });
  if (!user || user.role !== 'TAILLEUR') {
    throw new ApiError(404, 'INTROUVABLE', 'Tailleur introuvable.');
  }
  const viewerId = req.user?.sub ?? '';
  const designs = await prisma.design.findMany({
    where: { tailorId: user.id },
    orderBy: { id: 'desc' },
    take: 20,
    include: designInclude(viewerId),
  });
  const followedByMe = viewerId
    ? (await prisma.follow.findUnique({
        where: { followerId_tailorId: { followerId: viewerId, tailorId: user.id } },
      })) !== null
    : false;
  res.json({
    tailor: {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      profile: user.tailorProfile,
      followersCount: user._count.followers,
      designsCount: user._count.designs,
    },
    designs: designs.map(toApiDesign),
    followedByMe,
  });
});
```

Dans `apps/api/src/modules/users/users.routes.ts`, ajouter (imports : `z`, `requireRole`) :

```ts
const profileSchema = z
  .object({
    bio: z.string().max(500).optional(),
    location: z.string().max(120).optional(),
    specialties: z.array(z.string().min(1).max(40)).max(10).optional(),
    yearsExperience: z.number().int().min(0).max(80).optional(),
    priceMin: z.number().int().min(0).optional(),
    priceMax: z.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Aucune donnée à modifier.',
  })
  .refine(
    (d) => d.priceMin == null || d.priceMax == null || d.priceMin <= d.priceMax,
    { message: 'Le prix minimum doit être inférieur au prix maximum.' },
  );

usersRouter.patch('/me/profile', requireAuth, requireRole('TAILLEUR'), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const profile = await prisma.tailorProfile.update({
    where: { userId: req.user!.sub },
    data: parsed.data,
  });
  res.json({ profile });
});
```

Dans `apps/api/src/app.ts`, monter avant le 404 :

```ts
import { tailorsRouter } from './modules/tailors/tailors.routes.js';
// ...
app.use('/tailors', tailorsRouter);
```

- [ ] **Step 4: Vérifier le vert**

Run: `npm test -w apps/api`
Expected: PASS (9 nouveaux tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: follows, profil public tailleur et édition du profil"
```

---

### Task 9: Finition du jalon 2

**Files:**
- Modify: `README.md` (section endpoints)

**Interfaces:**
- Consumes: tout le jalon.
- Produces: jalon vérifié de bout en bout.

- [ ] **Step 1: Typecheck et suite complète**

Run: `npm run typecheck -w apps/api && npm test`
Expected: 0 erreur TS ; ~53 tests API verts + 2 shared (compter précisément et le noter).

- [ ] **Step 2: Vérification manuelle de bout en bout**

```bash
npm run dev:api &
sleep 2
# Inscrire un tailleur, publier un modèle avec une vraie image, lire le feed :
TOKEN=$(curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"phone":"+221772223344","password":"secret123","name":"Awa Couture","role":"TAILLEUR"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken))")
# Générer une image de test :
node -e "const sharp=require('./apps/api/node_modules/sharp');sharp({create:{width:600,height:800,channels:3,background:{r:210,g:105,b:30}}}).jpeg().toFile('/tmp/modele-test.jpg')"
curl -s -X POST http://localhost:3000/designs -H "Authorization: Bearer $TOKEN" \
  -F 'title=Boubou Tabaski' -F 'category=TABASKI' -F 'image=@/tmp/modele-test.jpg'
curl -s 'http://localhost:3000/designs?category=TABASKI'
```

Expected: 201 avec le design (imageUrl en `/uploads/….webp`), puis le feed contenant « Boubou Tabaski ». Vérifier que l'image répond : `curl -sI <imageUrl>` → 200. Arrêter le serveur (`kill %1`). Si le téléphone existe déjà (run précédent), utiliser `/auth/login` pour obtenir le token — le noter dans le rapport.

- [ ] **Step 3: Mettre à jour le README**

Dans `README.md`, ajouter à la fin de la section Structure :

```markdown

## API (jalon 2)

- `GET /designs` — feed public (filtres `category`, `search`, `sort=recent|tendance`, pagination `page`/`limit`)
- `POST /designs` — publier un modèle (tailleur, multipart `image` + `title` + `category`)
- `GET /designs/:id` — détail + commentaires
- `POST|DELETE /designs/:id/like` et `/bookmark` — réactions idempotentes
- `GET|POST /designs/:id/comments` — commentaires
- `GET /me/bookmarks` — mes modèles sauvegardés
- `POST|DELETE /tailors/:id/follow` — suivre un tailleur
- `GET /tailors/:id` — profil public (portfolio, followers)
- `PATCH /me/profile` — éditer son profil tailleur

Sans `CLOUDINARY_URL`, les images sont stockées dans `apps/api/uploads/` et servies sur `/uploads`.
```

- [ ] **Step 4: Commit final**

```bash
git add README.md
git commit -m "chore: README — endpoints du jalon 2 (feed & social)"
```
