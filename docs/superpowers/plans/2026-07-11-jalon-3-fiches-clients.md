# Jalon 3 — Fiches clients & mesures versionnées : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au tailleur son carnet d'atelier numérique : créer/gérer les fiches de ses clients (y compris des clients sans compte : nom + téléphone suffisent) et enregistrer leurs **15 mesures** en centimètres, **versionnées** (chaque saisie crée une nouvelle version, l'historique reste consultable).

**Architecture:** Extension de `apps/api` (Express 5 + Prisma). Deux nouveaux modèles : `ClientRecord` (fiche, propriété d'un tailleur, lien *optionnel* vers un compte `users` client) et `Measurement` (immuable, append-only : une nouvelle mise à jour = une nouvelle ligne). Nouvel enum `MeasurementSource` (`MANUELLE`, `IA` réservé à plus tard). Toutes les routes sont réservées au rôle `TAILLEUR` et protégées par un **contrôle de propriété systématique** (un tailleur ne touche que ses propres fiches ; sinon `404 INTROUVABLE`, jamais `403`, pour ne pas révéler l'existence d'une fiche d'autrui). Nouveau routeur `client-records` monté sur `/client-records`.

**Tech Stack:** existant (Express 5, Prisma 6, zod, Vitest+Supertest). Aucune nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-07-03-moodly-mvp-design.md` (sections « Cœur métier » → `client_records`/`measurements`, et « API REST » → Fiches clients).
**Prérequis:** Jalon 2 terminé (PR #2 `jalon-2-feed-social`, 57 tests API + 2 shared verts, typecheck strict vert). Créer la branche `jalon-3-fiches-clients` **à partir de `main` une fois la PR #2 mergée** (sinon à partir de `jalon-2-feed-social`).

## Global Constraints

- TypeScript `strict: true`, ESM, imports relatifs avec extension `.js`.
- Erreurs : `{ error: { code, message } }`, codes `MAJUSCULES_FRANCAISES`, messages français simples.
- **Toutes** les routes de ce jalon exigent le JWT (`requireAuth`) **et** le rôle `TAILLEUR` (`requireRole('TAILLEUR')`). Aucune lecture publique (contrairement au feed).
- **Contrôle de propriété** sur chaque accès à une fiche : si la fiche n'appartient pas au tailleur courant → `404 INTROUVABLE` (on ne distingue pas « inexistante » de « pas à toi »).
- Les 15 mesures sont celles de `@moodly/shared` (`MEASUREMENT_FIELDS`) : `tourPoitrine`, `tourTaille`, `tourHanches`, `largeurEpaules`, `longueurBras`, `tourBras`, `tourCou`, `entrejambe`, `longueurJambe`, `longueurBoubou`, `longueurChemise`, `tourCuisse`, `tourPoignet`, `carrureDos`, `longueurManche`. En cm, décimales autorisées, **toutes optionnelles** (le tailleur remplit ce qu'il veut), bornées `0 < x ≤ 300`.
- `Measurement` est **append-only** : jamais d'`UPDATE`/`DELETE` d'une version ; une correction = une nouvelle version. L'historique est renvoyé en ordre **antéchronologique** (plus récent d'abord).
- Le `phone` d'une fiche client est une donnée du carnet du tailleur (pas un compte) → il peut figurer dans la réponse de SES fiches. On ne renvoie jamais le `passwordHash` ni le `phone` du compte `users` lié.
- Commits en français, préfixes `feat:`/`fix:`/`test:`/`chore:`, terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Tous les chemins relatifs à `/Users/macbook_1/devperso/Moodly`. Suite : `npm test -w apps/api` (base : 57 tests API verts + 2 shared) ; typecheck : `npm run typecheck -w apps/api`. Postgres dev/test via Docker (port 5433) : `open -a Docker` puis `docker compose up -d db` si le démon ne tourne pas.

### Hors périmètre de ce jalon (assumé)

- La lecture par le **client** de ses propres mesures (`GET /me/measurements`) n'est pas dans la liste d'API du jalon 3 de la spec → reportée (jalon mobile / commandes). Le lien `ClientRecord.userId` est déjà posé pour la préparer.
- Source `IA` : l'enum est prévu mais seule `MANUELLE` est produite/testée.

---

### Task 1: Shared — sources de mesure

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/index.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `MEASUREMENT_SOURCES = ['MANUELLE', 'IA'] as const` et le type `MeasurementSource`. (`MEASUREMENT_FIELDS` existe déjà, inchangé.)

- [ ] **Step 1: Écrire le test qui échoue**

Dans `packages/shared/src/index.test.ts`, ajouter :

```ts
import { MEASUREMENT_SOURCES, MEASUREMENT_FIELDS } from './index.js';

it('expose les sources de mesure et 15 champs', () => {
  expect(MEASUREMENT_SOURCES).toContain('MANUELLE');
  expect(MEASUREMENT_SOURCES).toContain('IA');
  expect(MEASUREMENT_FIELDS).toHaveLength(15);
});
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -w packages/shared` → FAIL (`MEASUREMENT_SOURCES` indéfini).

- [ ] **Step 3: Implémenter** — dans `packages/shared/src/index.ts`, après `MEASUREMENT_FIELDS` :

```ts
export const MEASUREMENT_SOURCES = ['MANUELLE', 'IA'] as const;
export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number];
```

- [ ] **Step 4: Vérifier le vert** — `npm test -w packages/shared` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat: sources de mesure partagées (MANUELLE, IA)"
```

---

### Task 2: Modèles Prisma `ClientRecord` + `Measurement` + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_jalon3_fiches_clients/migration.sql` (généré)

**Interfaces:**
- Consumes: modèle `User` existant.
- Produces: tables `client_records` et `measurements`, enum `MeasurementSource`, relations sur `User`.

- [ ] **Step 1: Écrire le schéma**

Dans `apps/api/prisma/schema.prisma`, ajouter l'enum et les modèles :

```prisma
enum MeasurementSource {
  MANUELLE
  IA
}

model ClientRecord {
  id           String        @id @default(cuid())
  tailorId     String
  tailor       User          @relation("tailorClientRecords", fields: [tailorId], references: [id], onDelete: Cascade)
  userId       String?
  user         User?         @relation("clientLinkedRecords", fields: [userId], references: [id], onDelete: SetNull)
  name         String
  phone        String?
  stylePref    String?
  tissuPref    String?
  coupePref    String?
  notes        String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  measurements Measurement[]

  @@index([tailorId])
  @@map("client_records")
}

model Measurement {
  id              String            @id @default(cuid())
  clientRecordId  String
  clientRecord    ClientRecord      @relation(fields: [clientRecordId], references: [id], onDelete: Cascade)
  source          MeasurementSource @default(MANUELLE)
  tourPoitrine    Float?
  tourTaille      Float?
  tourHanches     Float?
  largeurEpaules  Float?
  longueurBras    Float?
  tourBras        Float?
  tourCou         Float?
  entrejambe      Float?
  longueurJambe   Float?
  longueurBoubou  Float?
  longueurChemise Float?
  tourCuisse      Float?
  tourPoignet     Float?
  carrureDos      Float?
  longueurManche  Float?
  createdAt       DateTime          @default(now())

  @@index([clientRecordId])
  @@map("measurements")
}
```

Et sur le modèle `User`, ajouter les deux relations inverses :

```prisma
  clientRecords ClientRecord[] @relation("tailorClientRecords")
  linkedRecords ClientRecord[] @relation("clientLinkedRecords")
```

- [ ] **Step 2: Générer la migration**

```bash
cd apps/api
dotenv -e .env -- npx prisma migrate dev --name jalon3_fiches_clients
```

Vérifier : la migration crée `client_records`, `measurements`, le type enum `MeasurementSource`, les FK et index. `prisma generate` s'exécute.

- [ ] **Step 3: Vérifier** — `npm run typecheck -w apps/api` → 0 erreur (le client Prisma régénéré connaît `prisma.clientRecord` / `prisma.measurement`).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat: modèles fiches clients et mesures versionnées + migration"
```

---

### Task 3: Créer et lister les fiches (`POST` / `GET /client-records`)

**Files:**
- Create: `apps/api/src/modules/client-records/client-records.service.ts`
- Create: `apps/api/src/modules/client-records/client-records.routes.ts`
- Modify: `apps/api/src/app.ts` (monter `clientRecordsRouter` sur `/client-records`)
- Test: `apps/api/tests/client-records.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole('TAILLEUR')`, `prisma`, `ApiError`, `z`.
- Produces:
  - `POST /client-records` (TAILLEUR) `{ name, phone?, userId?, stylePref?, tissuPref?, coupePref?, notes? }` → `201 { record }`. `name` requis. Si `userId` fourni : le compte doit exister et être de rôle `CLIENT`, sinon `400 CLIENT_INVALIDE`.
  - `GET /client-records` (TAILLEUR) → `200 { records }` : uniquement les fiches du tailleur courant, triées `updatedAt desc`. `403` pour un client, `401` sans token.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/client-records.test.ts` :

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();

let tailorToken: string;
let autreTailleurToken: string;
let clientToken: string;
let clientId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770006001');
  const autre = await registerUser(app, 'TAILLEUR', '+221770006002');
  const client = await registerUser(app, 'CLIENT', '+221770006003');
  tailorToken = tailor.token;
  autreTailleurToken = autre.token;
  clientToken = client.token;
  clientId = client.user.id;
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('POST /client-records', () => {
  it('crée une fiche minimale (nom seul) pour le tailleur', async () => {
    const res = await request(app)
      .post('/client-records')
      .set(auth(tailorToken))
      .send({ name: 'Awa Ndiaye', phone: '+221771112233' });
    expect(res.status).toBe(201);
    expect(res.body.record.name).toBe('Awa Ndiaye');
    expect(res.body.record.phone).toBe('+221771112233');
    expect(res.body.record.id).toBeTruthy();
  });

  it('peut lier un compte client existant', async () => {
    const res = await request(app)
      .post('/client-records')
      .set(auth(tailorToken))
      .send({ name: 'Client lié', userId: clientId });
    expect(res.status).toBe(201);
    expect(res.body.record.userId).toBe(clientId);
  });

  it('refuse un userId qui n’est pas un client (400)', async () => {
    const res = await request(app)
      .post('/client-records')
      .set(auth(tailorToken))
      .send({ name: 'X', userId: 'inexistant' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CLIENT_INVALIDE');
  });

  it('refuse un nom vide (400)', async () => {
    const res = await request(app).post('/client-records').set(auth(tailorToken)).send({});
    expect(res.status).toBe(400);
  });

  it('refuse un client (403) et l’anonyme (401)', async () => {
    expect((await request(app).post('/client-records').set(auth(clientToken)).send({ name: 'X' })).status).toBe(403);
    expect((await request(app).post('/client-records').send({ name: 'X' })).status).toBe(401);
  });
});

describe('GET /client-records', () => {
  it('ne liste que les fiches du tailleur courant', async () => {
    await request(app).post('/client-records').set(auth(tailorToken)).send({ name: 'A' });
    await request(app).post('/client-records').set(auth(tailorToken)).send({ name: 'B' });
    await request(app).post('/client-records').set(auth(autreTailleurToken)).send({ name: 'PasMoi' });

    const res = await request(app).get('/client-records').set(auth(tailorToken));
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(2);
    expect(res.body.records.map((r: { name: string }) => r.name)).not.toContain('PasMoi');
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -w apps/api` → FAIL (routes `/client-records` absentes → 404/401).

- [ ] **Step 3: Implémenter**

`apps/api/src/modules/client-records/client-records.service.ts` :

```ts
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

/** Récupère une fiche appartenant au tailleur, sinon 404 (jamais 403 : on ne révèle pas l'existence). */
export async function getOwnedRecord(tailorId: string, recordId: string) {
  const record = await prisma.clientRecord.findFirst({
    where: { id: recordId, tailorId },
  });
  if (!record) {
    throw new ApiError(404, 'INTROUVABLE', 'Fiche client introuvable.');
  }
  return record;
}

/** Valide qu'un userId optionnel référence bien un compte de rôle CLIENT. */
export async function assertLinkedClient(userId: string | undefined): Promise<void> {
  if (!userId) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== 'CLIENT') {
    throw new ApiError(400, 'CLIENT_INVALIDE', 'Le compte client lié est invalide.');
  }
}
```

`apps/api/src/modules/client-records/client-records.routes.ts` :

```ts
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { assertLinkedClient } from './client-records.service.js';

export const clientRecordsRouter = Router();

// Toutes les routes : tailleur authentifié.
clientRecordsRouter.use(requireAuth, requireRole('TAILLEUR'));

const createSchema = z.object({
  name: z.string().min(1, 'Le nom du client est requis.').max(120),
  phone: z.string().min(4).max(30).optional(),
  userId: z.string().min(1).optional(),
  stylePref: z.string().max(200).optional(),
  tissuPref: z.string().max(200).optional(),
  coupePref: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

clientRecordsRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  await assertLinkedClient(parsed.data.userId);
  const record = await prisma.clientRecord.create({
    data: { ...parsed.data, tailorId: req.user!.sub },
  });
  res.status(201).json({ record });
});

clientRecordsRouter.get('/', async (req, res) => {
  const records = await prisma.clientRecord.findMany({
    where: { tailorId: req.user!.sub },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ records });
});
```

Dans `apps/api/src/app.ts` : importer `clientRecordsRouter` et le monter avec `app.use('/client-records', clientRecordsRouter);` (avant le 404).

> Rappel Express 5 : partout où on lira `req.params.id`, utiliser la coercion `req.params.id as string` (le middleware augmente le type des params en `string | string[]`).

- [ ] **Step 4: Vérifier le vert** — `npm test -w apps/api` → PASS. `npm run typecheck -w apps/api` → 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: création et liste des fiches clients (tailleur)"
```

---

### Task 4: Détail, édition, suppression (`GET|PATCH|DELETE /client-records/:id`)

**Files:**
- Modify: `apps/api/src/modules/client-records/client-records.routes.ts`
- Test: `apps/api/tests/client-records.test.ts` (nouveau `describe`)

**Interfaces:**
- Consumes: `getOwnedRecord`, `assertLinkedClient`.
- Produces:
  - `GET /client-records/:id` (TAILLEUR, propriétaire) → `200 { record }` ; `404` si pas à lui/inconnu.
  - `PATCH /client-records/:id` → `200 { record }` (champs partiels ; corps vide → `400`).
  - `DELETE /client-records/:id` → `204` ; `404` si pas à lui/inconnu.

- [ ] **Step 1: Écrire les tests qui échouent** — ajouter à `client-records.test.ts` :

```ts
async function createRecord(token: string, name = 'Fiche') {
  const res = await request(app).post('/client-records').set(auth(token)).send({ name });
  return res.body.record.id as string;
}

describe('GET/PATCH/DELETE /client-records/:id', () => {
  it('lit, modifie puis supprime sa propre fiche', async () => {
    const id = await createRecord(tailorToken, 'Coumba');

    const get = await request(app).get(`/client-records/${id}`).set(auth(tailorToken));
    expect(get.status).toBe(200);
    expect(get.body.record.name).toBe('Coumba');

    const patch = await request(app)
      .patch(`/client-records/${id}`)
      .set(auth(tailorToken))
      .send({ notes: 'Préfère les coupes amples', tissuPref: 'Bazin' });
    expect(patch.status).toBe(200);
    expect(patch.body.record.notes).toBe('Préfère les coupes amples');
    expect(patch.body.record.tissuPref).toBe('Bazin');

    const del = await request(app).delete(`/client-records/${id}`).set(auth(tailorToken));
    expect(del.status).toBe(204);
    expect((await request(app).get(`/client-records/${id}`).set(auth(tailorToken))).status).toBe(404);
  });

  it('404 pour la fiche d’un autre tailleur (pas de fuite)', async () => {
    const id = await createRecord(autreTailleurToken, 'PasMoi');
    expect((await request(app).get(`/client-records/${id}`).set(auth(tailorToken))).status).toBe(404);
    expect((await request(app).patch(`/client-records/${id}`).set(auth(tailorToken)).send({ notes: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/client-records/${id}`).set(auth(tailorToken))).status).toBe(404);
  });

  it('refuse un PATCH vide (400)', async () => {
    const id = await createRecord(tailorToken);
    expect((await request(app).patch(`/client-records/${id}`).set(auth(tailorToken)).send({})).status).toBe(400);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -w apps/api` → FAIL.

- [ ] **Step 3: Implémenter** — dans `client-records.routes.ts`, importer `getOwnedRecord` et ajouter :

```ts
const updateSchema = createSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Aucune donnée à modifier.' },
);

clientRecordsRouter.get('/:id', async (req, res) => {
  const record = await getOwnedRecord(req.user!.sub, req.params.id as string);
  res.json({ record });
});

clientRecordsRouter.patch('/:id', async (req, res) => {
  await getOwnedRecord(req.user!.sub, req.params.id as string);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  await assertLinkedClient(parsed.data.userId);
  const record = await prisma.clientRecord.update({
    where: { id: req.params.id as string },
    data: parsed.data,
  });
  res.json({ record });
});

clientRecordsRouter.delete('/:id', async (req, res) => {
  await getOwnedRecord(req.user!.sub, req.params.id as string);
  await prisma.clientRecord.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
});
```

> Placer ces routes `:id` **après** les routes `POST /` et `GET /` (déjà le cas). `getOwnedRecord` garantit la propriété avant tout `update`/`delete`.

- [ ] **Step 4: Vérifier le vert** — `npm test -w apps/api` → PASS ; typecheck → 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: détail, édition et suppression des fiches clients (contrôle de propriété)"
```

---

### Task 5: Mesures versionnées (`POST` / `GET /client-records/:id/measurements`)

**Files:**
- Modify: `apps/api/src/modules/client-records/client-records.routes.ts`
- Modify: `apps/api/src/modules/client-records/client-records.service.ts` (schéma zod des mesures + helper)
- Test: `apps/api/tests/measurements.test.ts`

**Interfaces:**
- Consumes: `getOwnedRecord`, `MEASUREMENT_FIELDS`, `MEASUREMENT_SOURCES`.
- Produces:
  - `POST /client-records/:id/measurements` (TAILLEUR, propriétaire) `{ source?, <mesures...> }` → `201 { measurement }`. Au moins une mesure requise ; valeurs `0 < x ≤ 300`. Crée une **nouvelle version** et touche `updatedAt` de la fiche.
  - `GET /client-records/:id/measurements` → `200 { measurements }` : historique **antéchronologique**.
  - `GET /client-records/:id` renvoie désormais aussi `latestMeasurement` (la dernière version, ou `null`).

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/measurements.test.ts` :

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let tailorToken: string;
let recordId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770007001');
  tailorToken = tailor.token;
  const rec = await request(app).post('/client-records').set(auth(tailorToken)).send({ name: 'Client mesuré' });
  recordId = rec.body.record.id;
});

describe('mesures versionnées', () => {
  it('enregistre deux versions et renvoie l’historique antéchronologique', async () => {
    const v1 = await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken))
      .send({ tourPoitrine: 96, tourTaille: 80 });
    expect(v1.status).toBe(201);
    expect(v1.body.measurement.tourPoitrine).toBe(96);
    expect(v1.body.measurement.source).toBe('MANUELLE');

    await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken))
      .send({ tourPoitrine: 98, longueurBoubou: 145 });

    const hist = await request(app).get(`/client-records/${recordId}/measurements`).set(auth(tailorToken));
    expect(hist.status).toBe(200);
    expect(hist.body.measurements).toHaveLength(2);
    expect(hist.body.measurements[0].tourPoitrine).toBe(98); // plus récent d'abord

    const detail = await request(app).get(`/client-records/${recordId}`).set(auth(tailorToken));
    expect(detail.body.latestMeasurement.tourPoitrine).toBe(98);
  });

  it('refuse une version sans aucune mesure (400)', async () => {
    const res = await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken))
      .send({ source: 'MANUELLE' });
    expect(res.status).toBe(400);
  });

  it('refuse une valeur hors bornes (400)', async () => {
    const res = await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken))
      .send({ tourTaille: 999 });
    expect(res.status).toBe(400);
  });

  it('404 si la fiche n’est pas au tailleur', async () => {
    const autre = await registerUser(app, 'TAILLEUR', '+221770007002');
    const res = await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(autre.token))
      .send({ tourTaille: 80 });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -w apps/api` → FAIL.

- [ ] **Step 3: Implémenter**

Dans `client-records.service.ts`, ajouter le schéma des mesures construit depuis `@moodly/shared` :

```ts
import { z } from 'zod';
import { MEASUREMENT_FIELDS, MEASUREMENT_SOURCES } from '@moodly/shared';

const measure = z.number().positive().max(300);
const measureShape = Object.fromEntries(
  MEASUREMENT_FIELDS.map((f) => [f.key, measure.optional()]),
) as Record<(typeof MEASUREMENT_FIELDS)[number]['key'], typeof measure>;

export const measurementSchema = z
  .object({ source: z.enum(MEASUREMENT_SOURCES).default('MANUELLE'), ...measureShape })
  .refine(
    (d) => MEASUREMENT_FIELDS.some((f) => d[f.key] != null),
    { message: 'Renseigne au moins une mesure.' },
  );
```

Dans `client-records.routes.ts`, importer `getOwnedRecord`, `measurementSchema` et ajouter :

```ts
clientRecordsRouter.post('/:id/measurements', async (req, res) => {
  await getOwnedRecord(req.user!.sub, req.params.id as string);
  const parsed = measurementSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const [measurement] = await prisma.$transaction([
    prisma.measurement.create({
      data: { ...parsed.data, clientRecordId: req.params.id as string },
    }),
    prisma.clientRecord.update({
      where: { id: req.params.id as string },
      data: { updatedAt: new Date() },
    }),
  ]);
  res.status(201).json({ measurement });
});

clientRecordsRouter.get('/:id/measurements', async (req, res) => {
  await getOwnedRecord(req.user!.sub, req.params.id as string);
  const measurements = await prisma.measurement.findMany({
    where: { clientRecordId: req.params.id as string },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ measurements });
});
```

Enrichir `GET /client-records/:id` (Task 4) pour inclure la dernière mesure :

```ts
clientRecordsRouter.get('/:id', async (req, res) => {
  const record = await getOwnedRecord(req.user!.sub, req.params.id as string);
  const latestMeasurement = await prisma.measurement.findFirst({
    where: { clientRecordId: record.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ record, latestMeasurement });
});
```

> ⚠️ Ordre des routes : déclarer `/:id/measurements` **avant** `/:id` n'est pas nécessaire (Express distingue les segments), mais garder les routes `/:id/measurements` groupées après les routes de la fiche. Vérifier que `POST /:id/measurements` n'est pas masqué par une autre route.

- [ ] **Step 4: Vérifier le vert** — `npm test -w apps/api` → PASS ; typecheck → 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: mesures versionnées des fiches clients (15 mesures, historique)"
```

---

### Task 6: Finition du jalon 3

**Files:**
- Modify: `README.md` (section API)

**Interfaces:**
- Consumes: tout le jalon.
- Produces: jalon vérifié de bout en bout.

- [ ] **Step 1: Typecheck et suite complète**

Run: `npm run typecheck -w apps/api && npm test`
Expected: 0 erreur TS ; compter précisément les tests (≈ 57 + ~12 nouveaux API, + 2 shared) et le noter.

- [ ] **Step 2: Vérification manuelle de bout en bout**

```bash
npm run dev:api &
sleep 3
TOKEN=$(curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"phone":"+221773334455","password":"secret123","name":"Atelier Awa","role":"TAILLEUR"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken||''))")
# si 409 (déjà inscrit) : refaire avec /auth/login
REC=$(curl -s -X POST http://localhost:3000/client-records -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Fatou Sow","phone":"+221771002003","tissuPref":"Wax"}')
echo "$REC"
RID=$(echo "$REC" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).record.id))")
curl -s -X POST "http://localhost:3000/client-records/$RID/measurements" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"tourPoitrine":94,"tourTaille":78,"longueurBoubou":148}'
curl -s "http://localhost:3000/client-records/$RID" -H "Authorization: Bearer $TOKEN"
kill %1
```

Expected : création de la fiche (201), ajout d'une mesure (201), puis `GET` renvoyant la fiche + `latestMeasurement` avec `tourPoitrine: 94`. Noter le résultat dans le rapport.

- [ ] **Step 3: Mettre à jour le README** — sous la section « API », ajouter :

```markdown

## API — Fiches clients (jalon 3, rôle tailleur)

- `GET|POST /client-records` — lister / créer une fiche (client sans compte : nom + téléphone suffisent)
- `GET|PATCH|DELETE /client-records/:id` — détail (+ dernière mesure) / éditer / supprimer
- `POST /client-records/:id/measurements` — enregistrer une nouvelle version des 15 mesures
- `GET /client-records/:id/measurements` — historique des mesures (antéchronologique)

Un tailleur n'accède qu'à ses propres fiches (contrôle de propriété ; `404` sinon). Les mesures sont *append-only* : une correction crée une nouvelle version.
```

- [ ] **Step 4: Commit final**

```bash
git add README.md
git commit -m "chore: README — endpoints du jalon 3 (fiches clients & mesures)"
```

---

## Definition of Done (jalon 3)

- [ ] `ClientRecord` + `Measurement` + enum `MeasurementSource` migrés ; `prisma generate` OK.
- [ ] CRUD complet des fiches, réservé au rôle `TAILLEUR`, avec contrôle de propriété (`404`, pas de fuite d'existence).
- [ ] Lien optionnel vers un compte `CLIENT` validé (`400 CLIENT_INVALIDE` sinon).
- [ ] Mesures versionnées (append-only), au moins une mesure requise, bornes `0 < x ≤ 300`, historique antéchronologique, `latestMeasurement` dans le détail.
- [ ] Typecheck strict à 0 erreur ; suite complète verte (compte noté).
- [ ] Vérification E2E manuelle réussie ; README à jour.
- [ ] Branche `jalon-3-fiches-clients` prête pour PR vers `main`.
