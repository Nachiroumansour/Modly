# Jalon 5 — Commandes & suivi de production : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un client de **commander** un modèle à un tailleur, et au tailleur de **piloter la production** étape par étape avec une **timeline** de suivi visible côté client. Chaque commande fige une copie des mesures au moment où le tailleur la prépare.

**Architecture:** Extension de `apps/api` (Express 5 + Prisma). Deux modèles : `Order` (commande : client + tailleur + modèle optionnel + fiche liée optionnelle + **snapshot figé des mesures** + prix + statut paiement + statut production + livraison estimée) et `OrderEvent` (une ligne par changement de statut → timeline). Deux enums Prisma `OrderStatus` et `PaymentStatus` (miroirs de `@moodly/shared`). Nouveau routeur `orders` monté sur `/orders`. **Machine à états** de production validée côté serveur.

**Tech Stack:** existant (Express 5, Prisma 6, zod, Vitest+Supertest). Aucune nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-07-03-moodly-mvp-design.md` (sections « Cœur métier » → `orders`/`order_events`, et « API REST » → Commandes).
**Prérequis:** Jalons 1→3 terminés (70 tests API + 3 shared verts). Branche `jalon-5-commandes` créée à partir de `jalon-3-fiches-clients` (PR #3). Le jalon 4 (app mobile) est volontairement traité APRÈS ce jalon backend.

## Global Constraints

- TypeScript `strict: true`, ESM, imports relatifs `.js`. Erreurs `{ error: { code, message } }`, codes `MAJUSCULES_FRANCAISES`.
- JWT (`requireAuth`) obligatoire sur toutes les routes. Contrôle de **rôle** et de **propriété** systématique : un client ne voit/agit que sur SES commandes ; un tailleur, sur celles qui lui sont adressées. Accès à la commande d'autrui → `404 INTROUVABLE` (pas de fuite).
- Statuts de production = `ORDER_STATUSES` de `@moodly/shared` : `EN_ATTENTE` → `TISSU_RECU` → `COUPE` → `COUTURE` → `FINITIONS` → `PRET` → `LIVREE`, plus `ANNULEE`.
- Statuts de paiement = `PAYMENT_STATUSES` : `EN_ATTENTE`, `ACOMPTE`, `PAYE`.
- Le `snapshot` des mesures est **figé** (copie JSON immuable) : une fois posé, il ne suit plus les évolutions de la fiche.
- Ne jamais exposer `passwordHash`/`phone` d'un compte ; les parties client/tailleur d'une commande n'exposent que `id`, `name`, `avatarUrl`.
- Commits français, préfixes `feat:`/`fix:`/`test:`/`chore:`, terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Chemins relatifs à `/Users/macbook_1/devperso/Moodly`. Suite : `npm test -w apps/api` (base : 70 API + 3 shared) ; typecheck : `npm run typecheck -w apps/api`.

### Décisions produit assumées (à corriger si besoin)

1. **Qui crée la commande ?** Le **CLIENT** (conforme à la spec : `POST /orders (client)`). Il fournit `tailorId` (obligatoire, doit être un `TAILLEUR`), `designId?` (modèle choisi, ou commande libre), `note?`. La commande naît en `EN_ATTENTE` / paiement `EN_ATTENTE`.
2. **Champs commerciaux.** Ils relèvent du **tailleur** via `PATCH /orders/:id` (ajout au strict minimum de la spec, nécessaire pour qu'une commande soit exploitable) : `agreedPrice` (FCFA), `estimatedDelivery`, `paymentStatus`, et `clientRecordId` (lier une fiche). **Lier une fiche fige le snapshot** = copie de sa dernière mesure. La fiche doit appartenir au tailleur.
3. **Machine à états.** `PATCH /orders/:id/status` (tailleur) : avance **uniquement vers l'avant** dans la chaîne (index strictement croissant) ; `ANNULEE` possible depuis tout statut non terminal ; aucune transition depuis `LIVREE`/`ANNULEE` (terminaux). Chaque changement écrit un `OrderEvent` (timeline).
4. **Prix en entier (FCFA)** : `Int`, pas de décimales (le franc CFA n'a pas de centimes d'usage courant).

---

### Task 1: Modèles Prisma `Order` + `OrderEvent` + enums + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration générée.

**Interfaces:**
- Consumes: `User`, `Design`, `ClientRecord`.
- Produces: tables `orders`/`order_events`, enums `OrderStatus`/`PaymentStatus`, relations sur `User`.

- [ ] **Step 1: Écrire le schéma**

Ajouter les enums (miroirs de `@moodly/shared`) :

```prisma
enum OrderStatus {
  EN_ATTENTE
  TISSU_RECU
  COUPE
  COUTURE
  FINITIONS
  PRET
  LIVREE
  ANNULEE
}

enum PaymentStatus {
  EN_ATTENTE
  ACOMPTE
  PAYE
}
```

Et les modèles :

```prisma
model Order {
  id                   String        @id @default(cuid())
  clientId             String
  client               User          @relation("clientOrders", fields: [clientId], references: [id], onDelete: Cascade)
  tailorId             String
  tailor               User          @relation("tailorOrders", fields: [tailorId], references: [id], onDelete: Cascade)
  designId             String?
  design               Design?       @relation(fields: [designId], references: [id], onDelete: SetNull)
  clientRecordId       String?
  clientRecord         ClientRecord? @relation(fields: [clientRecordId], references: [id], onDelete: SetNull)
  measurementsSnapshot Json?
  note                 String?
  agreedPrice          Int?
  paymentStatus        PaymentStatus @default(EN_ATTENTE)
  status               OrderStatus   @default(EN_ATTENTE)
  estimatedDelivery    DateTime?
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt
  events               OrderEvent[]

  @@index([clientId])
  @@index([tailorId])
  @@map("orders")
}

model OrderEvent {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status    OrderStatus
  note      String?
  createdAt DateTime    @default(now())

  @@index([orderId])
  @@map("order_events")
}
```

Ajouter les relations inverses sur `User` :

```prisma
  clientOrders  Order[] @relation("clientOrders")
  tailorOrders  Order[] @relation("tailorOrders")
```

Et sur `Design` : `orders Order[]` ; sur `ClientRecord` : `orders Order[]`.

- [ ] **Step 2: Migration** — `cd apps/api && npx prisma migrate dev --name jalon5_commandes` (Prisma charge `.env`). Vérifier création des tables, enums, FK, index ; `prisma generate` OK.

- [ ] **Step 3: Vérifier** — `npm run typecheck -w apps/api` → 0 erreur.

- [ ] **Step 4: Commit** — `git add apps/api/prisma && git commit -m "feat: modèles commandes et timeline de production + migration"`

---

### Task 2: Créer une commande + lister (`POST` / `GET /orders`)

**Files:**
- Create: `apps/api/src/modules/orders/orders.service.ts`
- Create: `apps/api/src/modules/orders/orders.routes.ts`
- Modify: `apps/api/src/app.ts` (monter `ordersRouter` sur `/orders`)
- Test: `apps/api/tests/orders.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `prisma`, `ApiError`, `z`, `publicUserSelect`.
- Produces:
  - `POST /orders` (CLIENT) `{ tailorId, designId?, note? }` → `201 { order }`. `tailorId` doit être un `TAILLEUR` (sinon `400 TAILLEUR_INVALIDE`) ; `designId` optionnel doit exister (sinon `400 MODELE_INVALIDE`). Statut `EN_ATTENTE`, paiement `EN_ATTENTE`. Un premier `OrderEvent(EN_ATTENTE)` est créé (début de timeline).
  - `GET /orders` (CLIENT ou TAILLEUR) → `200 { orders }` : selon le rôle, les commandes où l'on est client, ou celles où l'on est tailleur ; triées `createdAt desc` ; chaque item inclut `client`/`tailor` publics et `design` minimal.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/orders.test.ts` :

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let clientToken: string;
let tailorToken: string;
let tailorId: string;
let designId: string;

beforeEach(async () => {
  const client = await registerUser(app, 'CLIENT', '+221770008001');
  const tailor = await registerUser(app, 'TAILLEUR', '+221770008002');
  clientToken = client.token;
  tailorToken = tailor.token;
  tailorId = tailor.user.id;
  const design = await prisma.design.create({
    data: {
      tailorId,
      title: 'Boubou de commande',
      category: 'BOUBOU',
      imageUrl: 'http://localhost:3000/uploads/o.webp',
      imageWidth: 600,
      imageHeight: 800,
    },
  });
  designId = design.id;
});

describe('POST /orders', () => {
  it('un client commande un modèle à un tailleur', async () => {
    const res = await request(app)
      .post('/orders')
      .set(auth(clientToken))
      .send({ tailorId, designId, note: 'Pour la Tabaski' });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('EN_ATTENTE');
    expect(res.body.order.paymentStatus).toBe('EN_ATTENTE');
    expect(res.body.order.designId).toBe(designId);
  });

  it('refuse un tailorId qui n’est pas un tailleur (400)', async () => {
    const autreClient = await registerUser(app, 'CLIENT', '+221770008003');
    const res = await request(app)
      .post('/orders')
      .set(auth(clientToken))
      .send({ tailorId: autreClient.user.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TAILLEUR_INVALIDE');
  });

  it('refuse un tailleur qui commande (403) et l’anonyme (401)', async () => {
    expect((await request(app).post('/orders').set(auth(tailorToken)).send({ tailorId })).status).toBe(403);
    expect((await request(app).post('/orders').send({ tailorId })).status).toBe(401);
  });
});

describe('GET /orders', () => {
  it('renvoie une vue différente selon le rôle', async () => {
    await request(app).post('/orders').set(auth(clientToken)).send({ tailorId, designId });

    const vueClient = await request(app).get('/orders').set(auth(clientToken));
    expect(vueClient.status).toBe(200);
    expect(vueClient.body.orders).toHaveLength(1);

    const vueTailleur = await request(app).get('/orders').set(auth(tailorToken));
    expect(vueTailleur.body.orders).toHaveLength(1);

    // Un autre tailleur ne voit rien.
    const autre = await registerUser(app, 'TAILLEUR', '+221770008004');
    const vueAutre = await request(app).get('/orders').set(auth(autre.token));
    expect(vueAutre.body.orders).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -w apps/api` → FAIL.

- [ ] **Step 3: Implémenter**

`orders.service.ts` :

```ts
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export const publicUserSelect = { id: true, name: true, avatarUrl: true } as const;

export async function assertTailor(tailorId: string): Promise<void> {
  const t = await prisma.user.findUnique({ where: { id: tailorId }, select: { role: true } });
  if (!t || t.role !== 'TAILLEUR') {
    throw new ApiError(400, 'TAILLEUR_INVALIDE', 'Le tailleur ciblé est invalide.');
  }
}

/** La commande, si l'utilisateur (client OU tailleur) en est partie prenante. Sinon 404. */
export async function getOwnedOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, OR: [{ clientId: userId }, { tailorId: userId }] },
  });
  if (!order) {
    throw new ApiError(404, 'INTROUVABLE', 'Commande introuvable.');
  }
  return order;
}
```

`orders.routes.ts` :

```ts
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { assertTailor, publicUserSelect } from './orders.service.js';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const createSchema = z.object({
  tailorId: z.string().min(1),
  designId: z.string().min(1).optional(),
  note: z.string().max(1000).optional(),
});

ordersRouter.post('/', requireRole('CLIENT'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  await assertTailor(parsed.data.tailorId);
  if (parsed.data.designId) {
    const design = await prisma.design.findUnique({
      where: { id: parsed.data.designId },
      select: { id: true },
    });
    if (!design) throw new ApiError(400, 'MODELE_INVALIDE', 'Le modèle choisi est introuvable.');
  }
  const order = await prisma.order.create({
    data: {
      clientId: req.user!.sub,
      tailorId: parsed.data.tailorId,
      designId: parsed.data.designId,
      note: parsed.data.note,
      events: { create: { status: 'EN_ATTENTE' } },
    },
  });
  res.status(201).json({ order });
});

ordersRouter.get('/', async (req, res) => {
  const where = req.user!.role === 'TAILLEUR'
    ? { tailorId: req.user!.sub }
    : { clientId: req.user!.sub };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: publicUserSelect },
      tailor: { select: publicUserSelect },
      design: { select: { id: true, title: true, imageUrl: true } },
    },
  });
  res.json({ orders });
});
```

> `req.user!.role` : vérifier que le payload JWT contient bien `role` (il est produit au login/register). Sinon, dériver le rôle via une lecture `prisma.user`. **Vérifier `TokenPayload` dans `src/middleware/auth.ts` avant de coder** et s'aligner.

Monter dans `app.ts` : `app.use('/orders', ordersRouter);` (avant le 404).

- [ ] **Step 4: Vérifier le vert** — `npm test -w apps/api` PASS ; typecheck 0 erreur.

- [ ] **Step 5: Commit** — `git commit -m "feat: création et liste des commandes (vue selon le rôle)"`

---

### Task 3: Détail + timeline (`GET /orders/:id`)

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`
- Test: `apps/api/tests/orders.test.ts`

**Interfaces:**
- Produces: `GET /orders/:id` (partie prenante) → `200 { order }` avec `client`/`tailor` publics, `design`, `clientRecord` (si liée), et `events` triés `createdAt asc` (timeline). `404` si non partie prenante/inconnu.

- [ ] **Step 1: Test** — ajouter à `orders.test.ts` :

```ts
describe('GET /orders/:id', () => {
  it('le client et le tailleur voient le détail + la timeline', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId, designId });
    const id = created.body.order.id;

    const vueClient = await request(app).get(`/orders/${id}`).set(auth(clientToken));
    expect(vueClient.status).toBe(200);
    expect(vueClient.body.order.events).toHaveLength(1);
    expect(vueClient.body.order.events[0].status).toBe('EN_ATTENTE');
    expect(vueClient.body.order.tailor.name).toBeTruthy();

    expect((await request(app).get(`/orders/${id}`).set(auth(tailorToken))).status).toBe(200);
  });

  it('404 pour un tiers non concerné', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    const autre = await registerUser(app, 'CLIENT', '+221770008009');
    expect((await request(app).get(`/orders/${created.body.order.id}`).set(auth(autre.token))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Rouge** — `npm test -w apps/api` FAIL.

- [ ] **Step 3: Implémenter** — importer `getOwnedOrder`, ajouter :

```ts
ordersRouter.get('/:id', async (req, res) => {
  await getOwnedOrder(req.user!.sub, req.params.id as string);
  const order = await prisma.order.findUnique({
    where: { id: req.params.id as string },
    include: {
      client: { select: publicUserSelect },
      tailor: { select: publicUserSelect },
      design: { select: { id: true, title: true, imageUrl: true } },
      clientRecord: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  res.json({ order });
});
```

- [ ] **Step 4: Vert** — PASS ; typecheck 0.

- [ ] **Step 5: Commit** — `git commit -m "feat: détail d'une commande avec timeline de suivi"`

---

### Task 4: Champs commerciaux + snapshot des mesures (`PATCH /orders/:id`)

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`, `orders.service.ts`
- Test: `apps/api/tests/orders.test.ts`

**Interfaces:**
- Produces: `PATCH /orders/:id` (TAILLEUR **propriétaire** de la commande) `{ agreedPrice?, estimatedDelivery?, paymentStatus?, clientRecordId? }` → `200 { order }`. Lier une `clientRecordId` (qui doit appartenir au tailleur) **fige** `measurementsSnapshot` = copie de la dernière mesure de la fiche. Corps vide → `400`. Commande d'un autre tailleur → `404`.

- [ ] **Step 1: Test** — ajouter :

```ts
describe('PATCH /orders/:id (tailleur)', () => {
  it('fixe le prix, le paiement et fige le snapshot des mesures via la fiche', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId, designId });
    const id = created.body.order.id;

    // Le tailleur crée une fiche + mesures.
    const rec = await request(app).post('/client-records').set(auth(tailorToken)).send({ name: 'Client cmd' });
    const recordId = rec.body.record.id;
    await request(app).post(`/client-records/${recordId}/measurements`).set(auth(tailorToken)).send({ tourPoitrine: 100 });

    const res = await request(app)
      .patch(`/orders/${id}`)
      .set(auth(tailorToken))
      .send({ agreedPrice: 25000, paymentStatus: 'ACOMPTE', clientRecordId: recordId });
    expect(res.status).toBe(200);
    expect(res.body.order.agreedPrice).toBe(25000);
    expect(res.body.order.paymentStatus).toBe('ACOMPTE');
    expect(res.body.order.measurementsSnapshot.tourPoitrine).toBe(100);
  });

  it('refuse le client (403) et la commande d’un autre tailleur (404)', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    const id = created.body.order.id;
    expect((await request(app).patch(`/orders/${id}`).set(auth(clientToken)).send({ agreedPrice: 1 })).status).toBe(403);
    const autre = await registerUser(app, 'TAILLEUR', '+221770008010');
    expect((await request(app).patch(`/orders/${id}`).set(auth(autre.token)).send({ agreedPrice: 1 })).status).toBe(404);
  });

  it('refuse un corps vide (400)', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    expect((await request(app).patch(`/orders/${created.body.order.id}`).set(auth(tailorToken)).send({})).status).toBe(400);
  });
});
```

- [ ] **Step 2: Rouge.**

- [ ] **Step 3: Implémenter** — dans `orders.service.ts`, ajouter un helper pour figer la fiche :

```ts
import { MEASUREMENT_FIELDS } from '@moodly/shared';

/** Vérifie que la fiche appartient au tailleur et renvoie le snapshot (dernière mesure) à figer. */
export async function snapshotFromRecord(tailorId: string, clientRecordId: string) {
  const record = await prisma.clientRecord.findFirst({ where: { id: clientRecordId, tailorId } });
  if (!record) throw new ApiError(400, 'FICHE_INVALIDE', 'La fiche client liée est invalide.');
  const latest = await prisma.measurement.findFirst({
    where: { clientRecordId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) return null;
  return Object.fromEntries(
    MEASUREMENT_FIELDS.map((f) => [f.key, latest[f.key as keyof typeof latest]]).filter(([, v]) => v != null),
  );
}
```

Dans `orders.routes.ts`, importer `getOwnedOrder`, `snapshotFromRecord`, `PAYMENT_STATUSES` de `@moodly/shared`, et ajouter (route réservée au tailleur, avec vérification de propriété manuelle car le tailleur doit être LE tailleur de la commande) :

```ts
const patchSchema = z
  .object({
    agreedPrice: z.number().int().min(0).optional(),
    estimatedDelivery: z.coerce.date().optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    clientRecordId: z.string().min(1).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune donnée à modifier.' });

ordersRouter.patch('/:id', requireRole('TAILLEUR'), async (req, res) => {
  const order = await getOwnedOrder(req.user!.sub, req.params.id as string);
  if (order.tailorId !== req.user!.sub) {
    throw new ApiError(404, 'INTROUVABLE', 'Commande introuvable.');
  }
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.clientRecordId) {
    data.measurementsSnapshot = await snapshotFromRecord(req.user!.sub, parsed.data.clientRecordId);
  }
  const updated = await prisma.order.update({ where: { id: order.id }, data });
  res.json({ order: updated });
});
```

> `getOwnedOrder` accepte client OU tailleur ; ici on restreint en plus à `order.tailorId === moi` pour renvoyer `404` (et non `403`) sur la commande d'un autre tailleur.

- [ ] **Step 4: Vert** ; typecheck 0.

- [ ] **Step 5: Commit** — `git commit -m "feat: champs commerciaux et snapshot figé des mesures sur la commande"`

---

### Task 5: Machine à états de production (`PATCH /orders/:id/status`)

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts`, `orders.service.ts`
- Test: `apps/api/tests/orders.test.ts`

**Interfaces:**
- Produces: `PATCH /orders/:id/status` (TAILLEUR propriétaire) `{ status, note? }` → `200 { order }` (avec `events`). Règles : avance uniquement vers un statut d'**index strictement supérieur** dans la chaîne ; `ANNULEE` autorisée depuis tout statut non terminal ; refus (`409 TRANSITION_INVALIDE`) si terminal (`LIVREE`/`ANNULEE`) ou recul. Chaque changement crée un `OrderEvent`.

- [ ] **Step 1: Test** — ajouter :

```ts
describe('PATCH /orders/:id/status (machine à états)', () => {
  it('avance dans la chaîne et enregistre la timeline', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    const id = created.body.order.id;

    expect((await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'TISSU_RECU' })).status).toBe(200);
    const r2 = await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'COUPE', note: 'Découpe faite' });
    expect(r2.status).toBe(200);
    expect(r2.body.order.status).toBe('COUPE');

    const detail = await request(app).get(`/orders/${id}`).set(auth(clientToken));
    // EN_ATTENTE (création) + TISSU_RECU + COUPE
    expect(detail.body.order.events).toHaveLength(3);
  });

  it('refuse un recul (409)', async () => {
    const created = await request(app).post('/orders').set(auth(tailorToken)).send; // placeholder — voir note
    const c = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    const id = c.body.order.id;
    await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'COUPE' });
    const back = await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'TISSU_RECU' });
    expect(back.status).toBe(409);
    expect(back.body.error.code).toBe('TRANSITION_INVALIDE');
  });

  it('permet d’annuler puis refuse toute transition ensuite', async () => {
    const c = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    const id = c.body.order.id;
    expect((await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'ANNULEE' })).status).toBe(200);
    expect((await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'COUPE' })).status).toBe(409);
  });

  it('refuse un client (403)', async () => {
    const c = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    expect((await request(app).patch(`/orders/${c.body.order.id}/status`).set(auth(clientToken)).send({ status: 'COUPE' })).status).toBe(403);
  });
});
```

> Nettoyer la ligne « placeholder » avant de committer le test (artefact de rédaction).

- [ ] **Step 2: Rouge.**

- [ ] **Step 3: Implémenter** — dans `orders.service.ts`, la logique de transition :

```ts
import { ORDER_STATUSES, type OrderStatus } from '@moodly/shared';

const CHAINE = ORDER_STATUSES.filter((s) => s !== 'ANNULEE'); // ordre de production

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === 'LIVREE' || from === 'ANNULEE') {
    throw new ApiError(409, 'TRANSITION_INVALIDE', 'Cette commande est terminée.');
  }
  if (to === 'ANNULEE') return; // annulation permise depuis tout statut non terminal
  const iFrom = CHAINE.indexOf(from);
  const iTo = CHAINE.indexOf(to);
  if (iTo <= iFrom) {
    throw new ApiError(409, 'TRANSITION_INVALIDE', 'On ne peut pas revenir en arrière.');
  }
}
```

Dans `orders.routes.ts`, ajouter :

```ts
const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(500).optional(),
});

ordersRouter.patch('/:id/status', requireRole('TAILLEUR'), async (req, res) => {
  const order = await getOwnedOrder(req.user!.sub, req.params.id as string);
  if (order.tailorId !== req.user!.sub) {
    throw new ApiError(404, 'INTROUVABLE', 'Commande introuvable.');
  }
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  assertTransition(order.status, parsed.data.status);
  const [updated] = await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: parsed.data.status } }),
    prisma.orderEvent.create({
      data: { orderId: order.id, status: parsed.data.status, note: parsed.data.note },
    }),
  ]);
  const withEvents = await prisma.order.findUnique({
    where: { id: updated.id },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  res.json({ order: withEvents });
});
```

- [ ] **Step 4: Vert** ; typecheck 0.

- [ ] **Step 5: Commit** — `git commit -m "feat: machine à états de production + timeline (PATCH /orders/:id/status)"`

---

### Task 6: Finition du jalon 5

**Files:** Modify `README.md`.

- [ ] **Step 1: Typecheck + suite complète** — `npm run typecheck -w apps/api && npm test` ; compter précisément et noter (≈ 70 + ~13 nouveaux API + 3 shared).

- [ ] **Step 2: Vérification E2E manuelle**

```bash
npm run dev:api &
sleep 3
CT=$(curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' -d '{"phone":"+221774440001","password":"secret123","name":"Client Test","role":"CLIENT"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken||''))")
TT=$(curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' -d '{"phone":"+221774440002","password":"secret123","name":"Atelier Test","role":"TAILLEUR"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken||''))")
TID=$(curl -s http://localhost:3000/me -H "Authorization: Bearer $TT" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).user.id))")
OID=$(curl -s -X POST http://localhost:3000/orders -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d "{\"tailorId\":\"$TID\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).order.id))")
curl -s -X PATCH "http://localhost:3000/orders/$OID/status" -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' -d '{"status":"TISSU_RECU"}'
curl -s "http://localhost:3000/orders/$OID" -H "Authorization: Bearer $CT"
kill %1
```

Expected : commande créée, statut passé à `TISSU_RECU`, `GET` renvoyant la commande avec 2 événements de timeline. Noter le résultat.

- [ ] **Step 3: README** — sous les sections API, ajouter :

```markdown

## API — Commandes (jalon 5)

- `POST /orders` (client) — commander un modèle à un tailleur
- `GET /orders` — mes commandes (vue client ou tailleur selon le rôle)
- `GET /orders/:id` — détail + timeline de suivi
- `PATCH /orders/:id` (tailleur) — prix, paiement, livraison, lier une fiche (fige les mesures)
- `PATCH /orders/:id/status` (tailleur) — faire avancer la production

Suivi de production : `EN_ATTENTE → TISSU_RECU → COUPE → COUTURE → FINITIONS → PRET → LIVREE` (ou `ANNULEE`). Avance vers l'avant uniquement ; chaque étape est horodatée dans la timeline.
```

- [ ] **Step 4: Commit** — `git add README.md && git commit -m "chore: README — endpoints du jalon 5 (commandes)"`

---

## Definition of Done (jalon 5)

- [ ] `Order` + `OrderEvent` + enums `OrderStatus`/`PaymentStatus` migrés ; `prisma generate` OK.
- [ ] `POST /orders` (client) avec validation tailleur/modèle ; timeline initialisée.
- [ ] `GET /orders` vue selon rôle ; `GET /orders/:id` détail + timeline, contrôle de propriété (`404`).
- [ ] `PATCH /orders/:id` (tailleur) : prix/paiement/livraison + snapshot figé des mesures via fiche.
- [ ] `PATCH /orders/:id/status` : machine à états (avance seule, annulation, terminaux), `OrderEvent` par transition, `409 TRANSITION_INVALIDE`.
- [ ] Typecheck strict 0 erreur ; suite complète verte (compte noté) ; E2E manuel OK ; README à jour.
- [ ] Branche `jalon-5-commandes` prête pour PR vers `main`.
