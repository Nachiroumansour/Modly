# M4 — Notifications (in-app + push) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter Modly d'un système de notifications regroupées (in-app testable maintenant + push Expo câblé pour la prod) déclenché par likes, commentaires, réponses, follows et commandes, avec une annulation de commande côté client.

**Architecture :** Une table `Notification` avec regroupement par `@@unique(recipientId, type, groupKey)` alimentée par un helper `createNotification()` appelé aux sites métier existants (best-effort, ne casse jamais l'action). Un helper `sendPush()` best-effort envoie vers l'API HTTP Expo Push (no-op sans jeton). Côté mobile : écran liste réel, pastille cloche, enregistrement du jeton push.

**Tech Stack :** Express 5 + Prisma 6 (Postgres) + Vitest/supertest côté API ; Expo SDK 54 / React Native + react-query + jest/RNTL + `expo-notifications` côté mobile.

## Global Constraints

- **Node 20 obligatoire pour Expo** (`expo export`/bundle) : le node système v18 casse Metro. API/tests tournent sous node 18 ou 20.
- **Prisma épinglé 6.x** — ne pas bumper.
- **Copy FR** dans tous les messages d'erreur et libellés. ASCII (`'` droit) dans les fichiers **.ts** (une apostrophe courbe U+2019 casse le tokenizer babel) ; U+2019 toléré en `.tsx`.
- **Jamais d'auto-notification** : si l'acteur est le destinataire, ne rien créer.
- **Une notif ratée ne fait jamais échouer l'action métier** : tout appel à `createNotification`/`sendPush` est encapsulé try/catch.
- Tests API : `createApp()` + helper `registerUser(app, role, phone)` ; `setup.ts` fait `TRUNCATE users CASCADE` en `beforeEach` ; migrations test via `npm test` (pretest `migrate deploy`).
- Migration dev : `cd apps/api && npx dotenv -e .env -- prisma migrate dev --name <nom>` (Postgres dev = Docker port 5433 ; `docker compose up -d` si éteint).
- Enums `OrderStatus` : `EN_ATTENTE, TISSU_RECU, COUPE, COUTURE, FINITIONS, PRET, LIVREE, ANNULEE`.

---

## File Structure

**API (`apps/api`)**
- `prisma/schema.prisma` — modifié : `Notification`, `PushToken`, enum `NotificationType`, relations inverses.
- `src/modules/notifications/notifications.service.ts` — créé : `createNotification()`, `sendPush()`, `notificationPushText()`, types.
- `src/modules/notifications/notifications.routes.ts` — créé : routes `/me/notifications*` + `/me/push-tokens*`.
- `src/app.ts` — modifié : monter le router.
- `src/modules/designs/designs.service.ts` — modifié : déclencheurs like + comment + reply.
- `src/modules/tailors/tailors.routes.ts` — modifié : déclencheur follow.
- `src/modules/orders/orders.routes.ts` — modifié : déclencheurs create + status + nouvelle route `/:id/cancel`.
- `src/modules/orders/orders.service.ts` — modifié : constante `CLIENT_CANCELLABLE` + garde.
- `tests/notifications.test.ts`, `tests/notification-triggers.test.ts`, `tests/order-cancel.test.ts`, `tests/push-tokens.test.ts` — créés.

**Mobile (`apps/mobile`)**
- `src/notifications/render.ts` — créé : `notificationText()` pur + type `ApiNotification`.
- `src/notifications/hooks.ts` — créé : `useNotifications`, `useUnreadCount`, `useMarkAllRead`.
- `src/notifications/push.ts` — créé : `registerPushToken`, `unregisterPushToken`, listeners.
- `app/notifications.tsx` — remplacé : liste réelle.
- `src/ui/AppHeader.tsx` — modifié : pastille non-lu.
- `src/auth/AuthContext.tsx` — modifié : (dé)enregistrement du jeton.
- `src/types.ts` — modifié : `ApiNotification`.
- `src/notifications/render.test.ts`, `src/notifications/NotificationsList.test.tsx`, `src/ui/AppHeader.test.tsx` — créés.

---

## Task 1: Schéma Prisma (Notification, PushToken, enum)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Migration: `apps/api/prisma/migrations/*`

**Interfaces:**
- Produces: modèles `Notification { id, recipientId, type, groupKey, actorCount, lastActorId, designId, commentId, orderId, read, createdAt, updatedAt }`, `PushToken { id, userId, token, createdAt }`, enum `NotificationType { LIKE COMMENT REPLY FOLLOW ORDER }`.

- [ ] **Step 1 : Ajouter enum + modèles à `schema.prisma`**

```prisma
enum NotificationType {
  LIKE
  COMMENT
  REPLY
  FOLLOW
  ORDER
}

model Notification {
  id          String           @id @default(cuid())
  recipientId String
  recipient   User             @relation("recipientNotifications", fields: [recipientId], references: [id], onDelete: Cascade)
  type        NotificationType
  groupKey    String
  actorCount  Int              @default(1)
  lastActorId String?
  lastActor   User?            @relation("actorNotifications", fields: [lastActorId], references: [id], onDelete: SetNull)
  designId    String?
  design      Design?          @relation(fields: [designId], references: [id], onDelete: Cascade)
  commentId   String?
  orderId     String?
  order       Order?           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  read        Boolean          @default(false)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@unique([recipientId, type, groupKey])
  @@index([recipientId, read])
  @@index([recipientId, updatedAt])
  @@map("notifications")
}

model PushToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("push_tokens")
}
```

- [ ] **Step 2 : Ajouter les relations inverses**

Sur `model User` : ajouter
```prisma
  recipientNotifications Notification[] @relation("recipientNotifications")
  actorNotifications     Notification[] @relation("actorNotifications")
  pushTokens             PushToken[]
```
Sur `model Design` : ajouter `notifications Notification[]`.
Sur `model Order` : ajouter `notifications Notification[]`.

- [ ] **Step 3 : Générer la migration**

Run (Docker Postgres dev lancé) :
```bash
cd apps/api && npx dotenv -e .env -- prisma migrate dev --name m4_notifications
```
Expected : migration créée + appliquée, `prisma generate` OK.

- [ ] **Step 4 : Vérifier que la suite existante passe toujours (schéma non cassant)**

Run : `cd apps/api && npm test`
Expected : 117 tests toujours verts (rien branché encore).

- [ ] **Step 5 : Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): schéma Notification + PushToken + enum NotificationType"
```

---

## Task 2: Helper `createNotification()` (upsert + regroupement + no-self)

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.service.ts`
- Test: `apps/api/tests/notifications.test.ts`

**Interfaces:**
- Produces:
  - `type NotifType = 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'ORDER'`
  - `createNotification(p: { recipientId: string; actorId: string; type: NotifType; groupKey: string; designId?: string | null; commentId?: string | null; orderId?: string | null }): Promise<void>`
  - Regroupe via upsert sur `(recipientId, type, groupKey)` ; skip si `actorId === recipientId`.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/api/tests/notifications.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';
import { createNotification } from '../src/modules/notifications/notifications.service.js';

const app = createApp();

let tailorId: string;
let awaId: string;
let oumarId: string;
let designId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770010001');
  const awa = await registerUser(app, 'CLIENT', '+221770010002');
  const oumar = await registerUser(app, 'CLIENT', '+221770010003');
  tailorId = tailor.user.id;
  awaId = awa.user.id;
  oumarId = oumar.user.id;
  const design = await prisma.design.create({
    data: {
      tailorId, title: 'Boubou', category: 'BOUBOU',
      imageUrl: 'http://x/o.webp', imageWidth: 600, imageHeight: 800,
    },
  });
  designId = design.id;
});

describe('createNotification (regroupement)', () => {
  it('regroupe deux likes sur un modèle en une notif (actorCount=2)', async () => {
    await createNotification({ recipientId: tailorId, actorId: awaId, type: 'LIKE', groupKey: `design:${designId}`, designId });
    await createNotification({ recipientId: tailorId, actorId: oumarId, type: 'LIKE', groupKey: `design:${designId}`, designId });
    const notifs = await prisma.notification.findMany({ where: { recipientId: tailorId } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].actorCount).toBe(2);
    expect(notifs[0].lastActorId).toBe(oumarId);
    expect(notifs[0].read).toBe(false);
  });

  it('ne crée jamais d’auto-notification', async () => {
    await createNotification({ recipientId: tailorId, actorId: tailorId, type: 'LIKE', groupKey: `design:${designId}`, designId });
    const count = await prisma.notification.count({ where: { recipientId: tailorId } });
    expect(count).toBe(0);
  });

  it('des groupKey différents créent des notifs distinctes', async () => {
    await createNotification({ recipientId: tailorId, actorId: awaId, type: 'COMMENT', groupKey: 'comment:c1', designId, commentId: 'c1' });
    await createNotification({ recipientId: tailorId, actorId: awaId, type: 'COMMENT', groupKey: 'comment:c2', designId, commentId: 'c2' });
    const count = await prisma.notification.count({ where: { recipientId: tailorId } });
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/api && npm test -- notifications`
Expected : FAIL (module `notifications.service` introuvable).

- [ ] **Step 3 : Implémenter le helper (sans push pour l’instant)**

```ts
// apps/api/src/modules/notifications/notifications.service.ts
import { prisma } from '../../lib/prisma.js';

export type NotifType = 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'ORDER';

export type CreateNotifParams = {
  recipientId: string;
  actorId: string;
  type: NotifType;
  groupKey: string;
  designId?: string | null;
  commentId?: string | null;
  orderId?: string | null;
};

/** Crée ou regroupe une notification. Jamais d'auto-notification. Best-effort. */
export async function createNotification(p: CreateNotifParams): Promise<void> {
  if (p.actorId === p.recipientId) return;
  try {
    await prisma.notification.upsert({
      where: {
        recipientId_type_groupKey: {
          recipientId: p.recipientId,
          type: p.type,
          groupKey: p.groupKey,
        },
      },
      create: {
        recipientId: p.recipientId,
        type: p.type,
        groupKey: p.groupKey,
        actorCount: 1,
        lastActorId: p.actorId,
        designId: p.designId ?? null,
        commentId: p.commentId ?? null,
        orderId: p.orderId ?? null,
        read: false,
      },
      update: {
        actorCount: { increment: 1 },
        lastActorId: p.actorId,
        read: false,
      },
    });
  } catch (err) {
    console.warn('createNotification a échoué (ignoré):', err);
  }
}
```
Note : le nom composé `recipientId_type_groupKey` est celui généré par Prisma pour `@@unique([recipientId, type, groupKey])` — vérifier dans le client généré si besoin.

- [ ] **Step 4 : Lancer le test — il passe**

Run : `cd apps/api && npm test -- notifications`
Expected : PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add apps/api/src/modules/notifications/notifications.service.ts apps/api/tests/notifications.test.ts
git commit -m "feat(api): helper createNotification (upsert regroupé, no-self)"
```

---

## Task 3: Helper `sendPush()` (Expo Push, best-effort, no-op sans jeton)

**Files:**
- Modify: `apps/api/src/modules/notifications/notifications.service.ts`
- Test: `apps/api/tests/notifications.test.ts` (nouveau describe)

**Interfaces:**
- Consumes: `prisma.pushToken`.
- Produces:
  - `sendPush(recipientId: string, payload: { title: string; body: string; data?: Record<string, unknown> }): Promise<void>`
  - `notificationPushText(type: NotifType, actorName: string, actorCount: number): { title: string; body: string }`
  - `createNotification` appelle `sendPush` après l'upsert (best-effort).

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// ajouter dans apps/api/tests/notifications.test.ts
import { vi } from 'vitest';
import { sendPush } from '../src/modules/notifications/notifications.service.js';

describe('sendPush (best-effort)', () => {
  it('no-op quand le destinataire n’a aucun jeton (fetch non appelé)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await sendPush(tailorId, { title: 'x', body: 'y' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('poste vers Expo quand un jeton existe', async () => {
    await prisma.pushToken.create({ data: { userId: tailorId, token: 'ExponentPushToken[abc]' } });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ status: 'ok' }] }), { status: 200 }),
    );
    await sendPush(tailorId, { title: 'Titre', body: 'Corps', data: { type: 'LIKE' } });
    expect(spy).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', expect.objectContaining({ method: 'POST' }));
    spy.mockRestore();
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/api && npm test -- notifications`
Expected : FAIL (`sendPush` non exporté).

- [ ] **Step 3 : Implémenter `sendPush` + `notificationPushText` + brancher dans `createNotification`**

Ajouter à `notifications.service.ts` :
```ts
type PushPayload = { title: string; body: string; data?: Record<string, unknown> };

const PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export async function sendPush(recipientId: string, payload: PushPayload): Promise<void> {
  const tokens = await prisma.pushToken.findMany({ where: { userId: recipientId }, select: { token: true } });
  if (tokens.length === 0) return; // no-op : aucun appareil enregistré
  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: 'default',
  }));
  try {
    const res = await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
    // Nettoyage best-effort des jetons invalides
    const results = json.data ?? [];
    await Promise.all(
      results.map((r, i) =>
        r?.status === 'error' && r.details?.error === 'DeviceNotRegistered'
          ? prisma.pushToken.deleteMany({ where: { token: tokens[i].token } })
          : Promise.resolve(),
      ),
    );
  } catch (err) {
    console.warn('sendPush a échoué (ignoré):', err);
  }
}

export function notificationPushText(type: NotifType, actorName: string, actorCount: number): PushPayload {
  const others = actorCount - 1;
  const who = others <= 0 ? actorName : others === 1 ? `${actorName} et 1 autre` : `${actorName} et ${others} autres`;
  switch (type) {
    case 'LIKE': return { title: 'Nouveau like', body: `${who} a aimé votre modèle.` };
    case 'COMMENT': return { title: 'Nouveau commentaire', body: `${actorName} a commenté votre modèle.` };
    case 'REPLY': return { title: 'Nouvelle réponse', body: `${actorName} a répondu à votre commentaire.` };
    case 'FOLLOW': return { title: 'Nouvel abonné', body: `${who} vous suit.` };
    case 'ORDER': return { title: 'Commande', body: `${actorName} : mise à jour de commande.` };
  }
}
```
Puis, à la fin de `createNotification` (dans le `try`, après l'upsert réussi) :
```ts
    const row = await prisma.notification.findUnique({
      where: { recipientId_type_groupKey: { recipientId: p.recipientId, type: p.type, groupKey: p.groupKey } },
      select: { actorCount: true, lastActor: { select: { name: true } } },
    });
    const actorName = row?.lastActor?.name ?? 'Quelqu’un';
    await sendPush(p.recipientId, notificationPushText(p.type, actorName, row?.actorCount ?? 1));
```
(L'apostrophe courbe dans `'Quelqu’un'` est dans un `.ts` → **remplacer par une apostrophe droite** `'Quelqu\'un'` ou `"Quelqu'un"` pour respecter la contrainte babel/ASCII.)

- [ ] **Step 4 : Lancer les tests — ils passent**

Run : `cd apps/api && npm test -- notifications`
Expected : PASS (5 tests). Vérifier que le describe « regroupement » passe toujours (fetch mocké/absent → sendPush no-op).

- [ ] **Step 5 : Commit**

```bash
git add apps/api/src/modules/notifications/notifications.service.ts apps/api/tests/notifications.test.ts
git commit -m "feat(api): sendPush Expo best-effort + texte push, branché dans createNotification"
```

---

## Task 4: Routes de lecture des notifications

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/notifications.test.ts` (nouveau describe HTTP)

**Interfaces:**
- Consumes: `requireAuth` de `../../middleware/auth.js`.
- Produces (montées sous `/me/notifications`) :
  - `GET /me/notifications?cursor=<id>` → `{ notifications: ApiNotification[], nextCursor: string | null }`
  - `GET /me/notifications/unread-count` → `{ count: number }`
  - `POST /me/notifications/read-all` → `{ ok: true }`
  - `POST /me/notifications/:id/read` → `{ ok: true }` (404 si pas destinataire)
  - Forme `ApiNotification` : `{ id, type, actorCount, read, createdAt, updatedAt, lastActor: { id, name, avatarUrl } | null, design: { id, title, imageUrl, coverBlurhash } | null, commentId: string | null, orderId: string | null }`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// ajouter dans apps/api/tests/notifications.test.ts
import request from 'supertest';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('GET /me/notifications', () => {
  it('liste les notifs du destinataire avec lastActor + compteur non-lu', async () => {
    const tailor = await registerUser(app, 'TAILLEUR', '+221770010009');
    const awa = await registerUser(app, 'CLIENT', '+221770010010');
    const design = await prisma.design.create({
      data: { tailorId: tailor.user.id, title: 'B', category: 'BOUBOU', imageUrl: 'http://x/o.webp', imageWidth: 600, imageHeight: 800 },
    });
    await createNotification({ recipientId: tailor.user.id, actorId: awa.user.id, type: 'LIKE', groupKey: `design:${design.id}`, designId: design.id });

    const list = await request(app).get('/me/notifications').set(auth(tailor.token));
    expect(list.status).toBe(200);
    expect(list.body.notifications).toHaveLength(1);
    expect(list.body.notifications[0].type).toBe('LIKE');
    expect(list.body.notifications[0].lastActor.name).toBe('Fatou');
    expect(list.body.notifications[0].design.id).toBe(design.id);

    const unread = await request(app).get('/me/notifications/unread-count').set(auth(tailor.token));
    expect(unread.body.count).toBe(1);

    await request(app).post('/me/notifications/read-all').set(auth(tailor.token));
    const unread2 = await request(app).get('/me/notifications/unread-count').set(auth(tailor.token));
    expect(unread2.body.count).toBe(0);
  });

  it('exige l’authentification (401)', async () => {
    expect((await request(app).get('/me/notifications')).status).toBe(401);
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/api && npm test -- notifications`
Expected : FAIL (404 sur les routes).

- [ ] **Step 3 : Implémenter le router + le monter**

```ts
// apps/api/src/modules/notifications/notifications.routes.ts
import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const PAGE = 30;

notificationsRouter.get('/', async (req, res) => {
  const cursor = req.query.cursor as string | undefined;
  const rows = await prisma.notification.findMany({
    where: { recipientId: req.user!.sub },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      lastActor: { select: { id: true, name: true, avatarUrl: true } },
      design: { select: { id: true, title: true, imageUrl: true, coverBlurhash: true } },
    },
  });
  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;
  res.json({
    notifications: page.map((n) => ({
      id: n.id,
      type: n.type,
      actorCount: n.actorCount,
      read: n.read,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      lastActor: n.lastActor,
      design: n.design,
      commentId: n.commentId,
      orderId: n.orderId,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

notificationsRouter.get('/unread-count', async (req, res) => {
  const count = await prisma.notification.count({ where: { recipientId: req.user!.sub, read: false } });
  res.json({ count });
});

notificationsRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { recipientId: req.user!.sub, read: false }, data: { read: true } });
  res.json({ ok: true });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const id = req.params.id as string;
  const notif = await prisma.notification.findUnique({ where: { id }, select: { recipientId: true } });
  if (!notif || notif.recipientId !== req.user!.sub) {
    throw new ApiError(404, 'INTROUVABLE', 'Notification introuvable.');
  }
  await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json({ ok: true });
});
```
Dans `apps/api/src/app.ts` : importer `notificationsRouter` et ajouter `app.use('/me/notifications', notificationsRouter);` (près des autres `app.use('/me/...')`).

- [ ] **Step 4 : Lancer le test — il passe**

Run : `cd apps/api && npm test -- notifications`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add apps/api/src/modules/notifications/notifications.routes.ts apps/api/src/app.ts apps/api/tests/notifications.test.ts
git commit -m "feat(api): routes lecture notifications (liste curseur, unread-count, read-all, read)"
```

---

## Task 5: Routes d'enregistrement des jetons push

**Files:**
- Modify: `apps/api/src/modules/notifications/notifications.routes.ts`
- Test: `apps/api/tests/push-tokens.test.ts`

**Interfaces:**
- Produces (mêmes préfixes montés, mais chemins `/me/push-tokens`) :
  - `POST /me/push-tokens` body `{ token: string }` → `{ ok: true }` (upsert ; ré-attribue au user courant)
  - `DELETE /me/push-tokens/:token` → `{ ok: true }`
- Note montage : ces routes sont sur un **router séparé** monté sous `/me/push-tokens` pour éviter la collision avec `/:id/read`. Créer `pushTokensRouter` dans le même fichier.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/api/tests/push-tokens.test.ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('/me/push-tokens', () => {
  it('enregistre puis supprime un jeton', async () => {
    const u = await registerUser(app, 'CLIENT', '+221770011001');
    const add = await request(app).post('/me/push-tokens').set(auth(u.token)).send({ token: 'ExponentPushToken[z]' });
    expect(add.status).toBe(200);
    expect(await prisma.pushToken.count({ where: { userId: u.user.id } })).toBe(1);

    // upsert idempotent
    await request(app).post('/me/push-tokens').set(auth(u.token)).send({ token: 'ExponentPushToken[z]' });
    expect(await prisma.pushToken.count({ where: { userId: u.user.id } })).toBe(1);

    const del = await request(app).delete('/me/push-tokens/' + encodeURIComponent('ExponentPushToken[z]')).set(auth(u.token));
    expect(del.status).toBe(200);
    expect(await prisma.pushToken.count({ where: { userId: u.user.id } })).toBe(0);
  });

  it('exige l’authentification (401)', async () => {
    expect((await request(app).post('/me/push-tokens').send({ token: 'x' })).status).toBe(401);
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/api && npm test -- push-tokens`
Expected : FAIL (404).

- [ ] **Step 3 : Implémenter `pushTokensRouter` + le monter**

Ajouter dans `notifications.routes.ts` :
```ts
import { z } from 'zod';

export const pushTokensRouter = Router();
pushTokensRouter.use(requireAuth);

const tokenSchema = z.object({ token: z.string().min(1).max(300) });

pushTokensRouter.post('/', async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', 'Jeton invalide.');
  await prisma.pushToken.upsert({
    where: { token: parsed.data.token },
    create: { token: parsed.data.token, userId: req.user!.sub },
    update: { userId: req.user!.sub },
  });
  res.json({ ok: true });
});

pushTokensRouter.delete('/:token', async (req, res) => {
  await prisma.pushToken.deleteMany({ where: { token: req.params.token as string, userId: req.user!.sub } });
  res.json({ ok: true });
});
```
Dans `app.ts` : `app.use('/me/push-tokens', pushTokensRouter);`

- [ ] **Step 4 : Lancer le test — il passe**

Run : `cd apps/api && npm test -- push-tokens`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add apps/api/src/modules/notifications/notifications.routes.ts apps/api/src/app.ts apps/api/tests/push-tokens.test.ts
git commit -m "feat(api): endpoints enregistrement/suppression jeton push"
```

---

## Task 6: Déclencheurs sociaux (like, commentaire, réponse, follow)

**Files:**
- Modify: `apps/api/src/modules/designs/designs.service.ts` (`addReaction`, `addComment`)
- Modify: `apps/api/src/modules/tailors/tailors.routes.ts` (POST follow)
- Test: `apps/api/tests/notification-triggers.test.ts`

**Interfaces:**
- Consumes: `createNotification` de `../notifications/notifications.service.js`.
- Produces: chaque action sociale crée la notif correspondante pour le bon destinataire.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/api/tests/notification-triggers.test.ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let tailor: Awaited<ReturnType<typeof registerUser>>;
let client: Awaited<ReturnType<typeof registerUser>>;
let designId: string;

beforeEach(async () => {
  tailor = await registerUser(app, 'TAILLEUR', '+221770012001');
  client = await registerUser(app, 'CLIENT', '+221770012002');
  const design = await prisma.design.create({
    data: { tailorId: tailor.user.id, title: 'B', category: 'BOUBOU', imageUrl: 'http://x/o.webp', imageWidth: 600, imageHeight: 800 },
  });
  designId = design.id;
});

describe('déclencheurs sociaux', () => {
  it('un like notifie le tailleur propriétaire', async () => {
    await request(app).post(`/designs/${designId}/like`).set(auth(client.token));
    const n = await prisma.notification.findMany({ where: { recipientId: tailor.user.id, type: 'LIKE' } });
    expect(n).toHaveLength(1);
    expect(n[0].lastActorId).toBe(client.user.id);
  });

  it('un commentaire notifie le tailleur', async () => {
    await request(app).post(`/designs/${designId}/comments`).set(auth(client.token)).send({ text: 'Superbe' });
    expect(await prisma.notification.count({ where: { recipientId: tailor.user.id, type: 'COMMENT' } })).toBe(1);
  });

  it('une réponse notifie l’auteur du commentaire parent', async () => {
    const c = await request(app).post(`/designs/${designId}/comments`).set(auth(client.token)).send({ text: 'Q' });
    await request(app).post(`/designs/${designId}/comments`).set(auth(tailor.token)).send({ text: 'R', parentId: c.body.comment.id });
    expect(await prisma.notification.count({ where: { recipientId: client.user.id, type: 'REPLY' } })).toBe(1);
  });

  it('un follow notifie le tailleur', async () => {
    await request(app).post(`/tailors/${tailor.user.id}/follow`).set(auth(client.token));
    expect(await prisma.notification.count({ where: { recipientId: tailor.user.id, type: 'FOLLOW' } })).toBe(1);
  });

  it('liker son propre modèle ne crée pas de notif', async () => {
    // le tailleur like son modèle
    await request(app).post(`/designs/${designId}/like`).set(auth(tailor.token));
    expect(await prisma.notification.count({ where: { recipientId: tailor.user.id } })).toBe(0);
  });
});
```
Vérifier le vrai chemin de la réponse de création de commentaire (`c.body.comment.id`) : adapter à la forme réelle renvoyée par `POST /designs/:id/comments` (cf `addComment` → `toApiComment`, la route renvoie probablement `{ comment }`).

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/api && npm test -- notification-triggers`
Expected : FAIL (aucune notif créée).

- [ ] **Step 3 : Brancher les déclencheurs**

Dans `designs.service.ts`, `addReaction` — dans le chemin succès (après le `$transaction`, uniquement `kind === 'like'`) :
```ts
    if (kind === 'like') {
      const design = await prisma.design.findUnique({ where: { id: designId }, select: { tailorId: true } });
      if (design) {
        await createNotification({
          recipientId: design.tailorId, actorId: userId,
          type: 'LIKE', groupKey: `design:${designId}`, designId,
        });
      }
    }
```
(Placer **après** le `try/catch` P2002, pour ne notifier que sur un like réellement nouveau : si le `catch` a `return`, on n'atteint pas ce code. Vérifier que le `return` du catch court-circuite bien.)

Dans `addComment` — après le `$transaction`, avant le `return` :
```ts
    const design = await prisma.design.findUnique({ where: { id: designId }, select: { tailorId: true } });
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { userId: true } });
      if (parent) {
        await createNotification({
          recipientId: parent.userId, actorId: userId,
          type: 'REPLY', groupKey: `reply:${comment.id}`, designId, commentId: comment.id,
        });
      }
    } else if (design) {
      await createNotification({
        recipientId: design.tailorId, actorId: userId,
        type: 'COMMENT', groupKey: `comment:${comment.id}`, designId, commentId: comment.id,
      });
    }
```
Ajouter l'import en tête de `designs.service.ts` : `import { createNotification } from '../notifications/notifications.service.js';`

Dans `tailors.routes.ts` (POST follow, ligne ~27) — envelopper la création pour ne notifier que si nouveau :
```ts
    try {
      await prisma.follow.create({ data: { followerId: req.user!.sub, tailorId } });
      await createNotification({
        recipientId: tailorId, actorId: req.user!.sub,
        type: 'FOLLOW', groupKey: 'follow',
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      // déjà suivi : idempotent, pas de nouvelle notif
    }
```
Adapter au code existant (il gère peut-être déjà P2002) ; importer `createNotification` et `Prisma` si besoin.

- [ ] **Step 4 : Lancer le test — il passe**

Run : `cd apps/api && npm test -- notification-triggers`
Expected : PASS (5 tests). Puis `npm test` complet pour non-régression.

- [ ] **Step 5 : Commit**

```bash
git add apps/api/src/modules/designs/designs.service.ts apps/api/src/modules/tailors/tailors.routes.ts apps/api/tests/notification-triggers.test.ts
git commit -m "feat(api): notifs sur like, commentaire, réponse, follow"
```

---

## Task 7: Déclencheurs commande (création + changement de statut)

**Files:**
- Modify: `apps/api/src/modules/orders/orders.routes.ts` (POST `/`, PATCH `/:id/status`)
- Test: `apps/api/tests/notification-triggers.test.ts` (nouveau describe)

**Interfaces:**
- Consumes: `createNotification`.
- Produces: création de commande → notif **tailleur** ; changement de statut → notif **client**.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// ajouter dans notification-triggers.test.ts
describe('déclencheurs commande', () => {
  it('une nouvelle commande notifie le tailleur', async () => {
    await request(app).post('/orders').set(auth(client.token)).send({ tailorId: tailor.user.id, designId });
    const n = await prisma.notification.findMany({ where: { recipientId: tailor.user.id, type: 'ORDER' } });
    expect(n).toHaveLength(1);
    expect(n[0].lastActorId).toBe(client.user.id);
  });

  it('un changement de statut notifie le client', async () => {
    const created = await request(app).post('/orders').set(auth(client.token)).send({ tailorId: tailor.user.id, designId });
    const orderId = created.body.order.id;
    await request(app).patch(`/orders/${orderId}/status`).set(auth(tailor.token)).send({ status: 'TISSU_RECU' });
    const n = await prisma.notification.findMany({ where: { recipientId: client.user.id, type: 'ORDER' } });
    expect(n.length).toBeGreaterThanOrEqual(1);
    expect(n.some((x) => x.orderId === orderId)).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/api && npm test -- notification-triggers`
Expected : FAIL sur le nouveau describe.

- [ ] **Step 3 : Brancher les déclencheurs commande**

Dans `orders.routes.ts`, import : `import { createNotification } from '../notifications/notifications.service.js';`

POST `/` — après `res.status(201).json(...)` non : **avant** la réponse, après `order` créé :
```ts
  await createNotification({
    recipientId: parsed.data.tailorId, actorId: req.user!.sub,
    type: 'ORDER', groupKey: `order:${order.id}:EN_ATTENTE`, orderId: order.id, designId: parsed.data.designId ?? null,
  });
  res.status(201).json({ order });
```

PATCH `/:id/status` — après le `$transaction`, avant la réponse :
```ts
  await createNotification({
    recipientId: order.clientId, actorId: req.user!.sub,
    type: 'ORDER', groupKey: `order:${order.id}:${parsed.data.status}`, orderId: order.id,
  });
```
(`order.clientId` est disponible via `getOwnedOrder` ; vérifier qu'il est bien sélectionné, sinon le récupérer.)

- [ ] **Step 4 : Lancer le test — il passe**

Run : `cd apps/api && npm test -- notification-triggers`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add apps/api/src/modules/orders/orders.routes.ts apps/api/tests/notification-triggers.test.ts
git commit -m "feat(api): notifs sur création et changement de statut de commande"
```

---

## Task 8: Annulation client + notif tailleur

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts` (constante + garde)
- Modify: `apps/api/src/modules/orders/orders.routes.ts` (route `PATCH /:id/cancel`)
- Test: `apps/api/tests/order-cancel.test.ts`

**Interfaces:**
- Produces:
  - `CLIENT_CANCELLABLE: readonly OrderStatus[]` = `['EN_ATTENTE', 'TISSU_RECU']` dans `orders.service.ts`.
  - `PATCH /orders/:id/cancel` (`requireRole('CLIENT')`) → `{ order }` ; 409 `ANNULATION_IMPOSSIBLE` dès `COUPE` ; 404 si pas propriétaire ; notifie le tailleur.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/api/tests/order-cancel.test.ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let tailor: Awaited<ReturnType<typeof registerUser>>;
let client: Awaited<ReturnType<typeof registerUser>>;

async function makeOrder(status: string) {
  const created = await request(app).post('/orders').set(auth(client.token)).send({ tailorId: tailor.user.id });
  const id = created.body.order.id;
  if (status !== 'EN_ATTENTE') {
    // avancer via le tailleur jusqu'au statut voulu
    const chain = ['TISSU_RECU', 'COUPE'];
    for (const s of chain) {
      await request(app).patch(`/orders/${id}/status`).set(auth(tailor.token)).send({ status: s });
      if (s === status) break;
    }
  }
  return id;
}

beforeEach(async () => {
  tailor = await registerUser(app, 'TAILLEUR', '+221770013001');
  client = await registerUser(app, 'CLIENT', '+221770013002');
});

describe('PATCH /orders/:id/cancel (client)', () => {
  it('annule une commande EN_ATTENTE et notifie le tailleur', async () => {
    const id = await makeOrder('EN_ATTENTE');
    const res = await request(app).patch(`/orders/${id}/cancel`).set(auth(client.token));
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('ANNULEE');
    expect(await prisma.notification.count({ where: { recipientId: tailor.user.id, type: 'ORDER' } })).toBeGreaterThanOrEqual(1);
    const events = await prisma.orderEvent.findMany({ where: { orderId: id, status: 'ANNULEE' } });
    expect(events).toHaveLength(1);
  });

  it('annule aussi au stade TISSU_RECU', async () => {
    const id = await makeOrder('TISSU_RECU');
    const res = await request(app).patch(`/orders/${id}/cancel`).set(auth(client.token));
    expect(res.status).toBe(200);
  });

  it('refuse l’annulation dès COUPE (409)', async () => {
    const id = await makeOrder('COUPE');
    const res = await request(app).patch(`/orders/${id}/cancel`).set(auth(client.token));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ANNULATION_IMPOSSIBLE');
  });

  it('refuse un non-propriétaire (404) et un tailleur (403)', async () => {
    const id = await makeOrder('EN_ATTENTE');
    const autre = await registerUser(app, 'CLIENT', '+221770013003');
    expect((await request(app).patch(`/orders/${id}/cancel`).set(auth(autre.token))).status).toBe(404);
    expect((await request(app).patch(`/orders/${id}/cancel`).set(auth(tailor.token))).status).toBe(403);
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/api && npm test -- order-cancel`
Expected : FAIL (route absente → 404/403 pas comme attendu).

- [ ] **Step 3 : Implémenter la garde + la route**

Dans `orders.service.ts` :
```ts
/** Statuts où le client peut encore annuler lui-même (avant la coupe du tissu). */
export const CLIENT_CANCELLABLE: readonly OrderStatus[] = ['EN_ATTENTE', 'TISSU_RECU'];
```
Dans `orders.routes.ts` (importer `CLIENT_CANCELLABLE`) :
```ts
ordersRouter.patch('/:id/cancel', requireRole('CLIENT'), async (req, res) => {
  const order = await getOwnedOrder(req.user!.sub, req.params.id as string);
  if (order.clientId !== req.user!.sub) {
    throw new ApiError(404, 'INTROUVABLE', 'Commande introuvable.');
  }
  if (order.status === 'ANNULEE') {
    res.json({ order }); // idempotent
    return;
  }
  if (!CLIENT_CANCELLABLE.includes(order.status)) {
    throw new ApiError(409, 'ANNULATION_IMPOSSIBLE', 'Cette commande est trop avancée pour être annulée.');
  }
  const [updated] = await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: 'ANNULEE' } }),
    prisma.orderEvent.create({ data: { orderId: order.id, status: 'ANNULEE', note: 'Annulée par le client' } }),
  ]);
  await createNotification({
    recipientId: order.tailorId, actorId: req.user!.sub,
    type: 'ORDER', groupKey: `order:${order.id}:ANNULEE`, orderId: order.id,
  });
  res.json({ order: updated });
});
```
Vérifier que `getOwnedOrder` renvoie `status`, `clientId`, `tailorId` ; sinon élargir son `select`.

- [ ] **Step 4 : Lancer le test — il passe**

Run : `cd apps/api && npm test -- order-cancel`
Expected : PASS. Puis `npm test` complet + `npm run typecheck`.

- [ ] **Step 5 : Commit**

```bash
git add apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/orders/orders.routes.ts apps/api/tests/order-cancel.test.ts
git commit -m "feat(api): annulation client avant la coupe + notif tailleur"
```

---

## Task 9: Mobile — helper de rendu `notificationText()` + type

**Files:**
- Create: `apps/mobile/src/notifications/render.ts`
- Modify: `apps/mobile/src/types.ts`
- Test: `apps/mobile/src/notifications/render.test.ts`

**Interfaces:**
- Produces:
  - Type `ApiNotification` dans `types.ts` : `{ id: string; type: 'LIKE'|'COMMENT'|'REPLY'|'FOLLOW'|'ORDER'; actorCount: number; read: boolean; createdAt: string; updatedAt: string; lastActor: { id: string; name: string; avatarUrl: string | null } | null; design: { id: string; title: string; imageUrl: string; coverBlurhash: string | null } | null; commentId: string | null; orderId: string | null }`
  - `notificationText(n: ApiNotification): string` — libellé FR regroupé.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/mobile/src/notifications/render.test.ts
import { notificationText } from './render';
import type { ApiNotification } from '../types';

function n(over: Partial<ApiNotification>): ApiNotification {
  return {
    id: 'n1', type: 'LIKE', actorCount: 1, read: false,
    createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
    lastActor: { id: 'a1', name: 'Awa', avatarUrl: null },
    design: null, commentId: null, orderId: null, ...over,
  };
}

describe('notificationText', () => {
  it('like simple', () => {
    expect(notificationText(n({ type: 'LIKE', actorCount: 1 }))).toBe('Awa a aimé votre modèle.');
  });
  it('like regroupé', () => {
    expect(notificationText(n({ type: 'LIKE', actorCount: 3 }))).toBe('Awa et 2 autres ont aimé votre modèle.');
  });
  it('like regroupé singulier', () => {
    expect(notificationText(n({ type: 'LIKE', actorCount: 2 }))).toBe('Awa et 1 autre ont aimé votre modèle.');
  });
  it('follow', () => {
    expect(notificationText(n({ type: 'FOLLOW', actorCount: 1 }))).toBe('Awa vous suit.');
  });
  it('commentaire', () => {
    expect(notificationText(n({ type: 'COMMENT' }))).toBe('Awa a commenté votre modèle.');
  });
  it('réponse', () => {
    expect(notificationText(n({ type: 'REPLY' }))).toBe('Awa a répondu à votre commentaire.');
  });
  it('commande', () => {
    expect(notificationText(n({ type: 'ORDER' }))).toBe('Awa : mise à jour de votre commande.');
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/mobile && npm test -- render`
Expected : FAIL (module absent).

- [ ] **Step 3 : Implémenter `render.ts` + ajouter le type**

Ajouter `ApiNotification` dans `src/types.ts` (voir Interfaces).
```ts
// apps/mobile/src/notifications/render.ts
import type { ApiNotification } from '../types';

// NB: fichier .ts -> apostrophes DROITES uniquement (contrainte babel).
function who(name: string, actorCount: number): string {
  const others = actorCount - 1;
  if (others <= 0) return name;
  if (others === 1) return `${name} et 1 autre`;
  return `${name} et ${others} autres`;
}

export function notificationText(n: ApiNotification): string {
  const name = n.lastActor?.name ?? 'Quelqu\'un';
  switch (n.type) {
    case 'LIKE': return `${who(name, n.actorCount)} ${n.actorCount > 1 ? 'ont' : 'a'} aimé votre modèle.`;
    case 'FOLLOW': return `${who(name, n.actorCount)} vous ${n.actorCount > 1 ? 'suivent' : 'suit'}.`;
    case 'COMMENT': return `${name} a commenté votre modèle.`;
    case 'REPLY': return `${name} a répondu à votre commentaire.`;
    case 'ORDER': return `${name} : mise à jour de votre commande.`;
  }
}
```

- [ ] **Step 4 : Lancer le test — il passe**

Run : `cd apps/mobile && npm test -- render`
Expected : PASS (7 tests).

- [ ] **Step 5 : Commit**

```bash
git add apps/mobile/src/notifications/render.ts apps/mobile/src/types.ts apps/mobile/src/notifications/render.test.ts
git commit -m "feat(mobile): type ApiNotification + notificationText (rendu regroupé FR)"
```

---

## Task 10: Mobile — hooks react-query

**Files:**
- Create: `apps/mobile/src/notifications/hooks.ts`

**Interfaces:**
- Consumes: `apiFetch`, `useAuth`, `ApiNotification`.
- Produces:
  - `useNotifications(): { notifications: ApiNotification[]; isLoading; isError; hasMore; loadMore; refetch }`
  - `useUnreadCount(): { count: number; refetch }`
  - `useMarkAllRead(): { markAllRead: () => Promise<void> }`

- [ ] **Step 1 : Implémenter les hooks (pas de test unitaire dédié — couverts via l’écran en Task 11)**

```ts
// apps/mobile/src/notifications/hooks.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ApiNotification } from '../types';

type Page = { notifications: ApiNotification[]; nextCursor: string | null };

export function useNotifications() {
  const { token } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ['notifications'],
    enabled: Boolean(token),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch<Page>(`/me/notifications${pageParam ? `?cursor=${pageParam}` : ''}`, { token }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  return {
    notifications: q.data?.pages.flatMap((p) => p.notifications) ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    hasMore: Boolean(q.hasNextPage),
    loadMore: () => q.fetchNextPage(),
    refetch: () => q.refetch(),
  };
}

export function useUnreadCount() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['notifications', 'unread'],
    enabled: Boolean(token),
    refetchOnWindowFocus: true,
    queryFn: () => apiFetch<{ count: number }>('/me/notifications/unread-count', { token }),
  });
  return { count: q.data?.count ?? 0, refetch: () => q.refetch() };
}

export function useMarkAllRead() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/me/notifications/read-all', { method: 'POST', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  return { markAllRead: () => m.mutateAsync() };
}
```

- [ ] **Step 2 : Vérifier le typecheck**

Run : `cd apps/mobile && npm run typecheck`
Expected : PASS.

- [ ] **Step 3 : Commit**

```bash
git add apps/mobile/src/notifications/hooks.ts
git commit -m "feat(mobile): hooks notifications (liste curseur, unread-count, read-all)"
```

---

## Task 11: Mobile — écran Notifications réel

**Files:**
- Create: `apps/mobile/src/notifications/NotificationsList.tsx` (composant testable, sans hooks de navigation)
- Modify: `apps/mobile/app/notifications.tsx` (branche hooks + navigation)
- Test: `apps/mobile/src/notifications/NotificationsList.test.tsx`

**Interfaces:**
- Consumes: `notificationText`, `ApiNotification`, `imageUri`.
- Produces: `NotificationsList({ notifications, onPress }: { notifications: ApiNotification[]; onPress: (n: ApiNotification) => void })` — liste sombre, avatar/vignette, texte, point non-lu.

- [ ] **Step 1 : Écrire le test qui échoue**

```tsx
// apps/mobile/src/notifications/NotificationsList.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NotificationsList } from './NotificationsList';
import type { ApiNotification } from '../types';

const base: ApiNotification = {
  id: 'n1', type: 'LIKE', actorCount: 2, read: false,
  createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
  lastActor: { id: 'a1', name: 'Awa', avatarUrl: null },
  design: { id: 'd1', title: 'Boubou', imageUrl: 'http://x/o.webp', coverBlurhash: null },
  commentId: null, orderId: null,
};

describe('NotificationsList', () => {
  it('affiche le texte regroupé et signale le non-lu', () => {
    render(<NotificationsList notifications={[base]} onPress={() => {}} />);
    expect(screen.getByText('Awa et 1 autre ont aimé votre modèle.')).toBeTruthy();
    expect(screen.getByTestId('notif-unread-n1')).toBeTruthy();
  });

  it('appelle onPress au tap', () => {
    const onPress = jest.fn();
    render(<NotificationsList notifications={[base]} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('notif-row-n1'));
    expect(onPress).toHaveBeenCalledWith(base);
  });

  it('n’affiche pas le point non-lu quand read=true', () => {
    render(<NotificationsList notifications={[{ ...base, read: true }]} onPress={() => {}} />);
    expect(screen.queryByTestId('notif-unread-n1')).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/mobile && npm test -- NotificationsList`
Expected : FAIL (composant absent).

- [ ] **Step 3 : Implémenter `NotificationsList.tsx`**

```tsx
// apps/mobile/src/notifications/NotificationsList.tsx
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUri } from '../lib/config';
import { colors, fonts, radius, spacing } from '../theme';
import type { ApiNotification } from '../types';
import { notificationText } from './render';

export function NotificationsList({
  notifications,
  onPress,
}: {
  notifications: ApiNotification[];
  onPress: (n: ApiNotification) => void;
}) {
  return (
    <FlatList
      data={notifications}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ paddingVertical: spacing.sm }}
      renderItem={({ item }) => (
        <Pressable testID={`notif-row-${item.id}`} style={styles.row} onPress={() => onPress(item)}>
          {item.lastActor?.avatarUrl ? (
            <Image source={{ uri: imageUri(item.lastActor.avatarUrl) }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{item.lastActor?.name?.[0] ?? '?'}</Text>
            </View>
          )}
          <Text style={styles.text}>{notificationText(item)}</Text>
          {item.design ? (
            <Image source={{ uri: imageUri(item.design.imageUrl) }} style={styles.thumb} />
          ) : null}
          {!item.read ? <View testID={`notif-unread-${item.id}`} style={styles.dot} /> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.inkElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 18 },
  text: { flex: 1, color: colors.textOnDark, fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 20 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
```
Vérifier les tokens réels dans `theme.ts` (`radius.sm`, `colors.inkElevated`, etc.) et ajuster si absents.

- [ ] **Step 4 : Brancher l’écran `app/notifications.tsx`**

Remplacer le corps de `app/notifications.tsx` : garder le header, remplacer l’état vide par la liste, marquer tout lu à l’ouverture, router au tap.
```tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useNotifications, useMarkAllRead } from '../src/notifications/hooks';
import { NotificationsList } from '../src/notifications/NotificationsList';
import type { ApiNotification } from '../src/types';
// ... (garder les imports/JSX du header existant)

export default function Notifications() {
  const router = useRouter();
  const { notifications } = useNotifications();
  const { markAllRead } = useMarkAllRead();
  useEffect(() => { markAllRead().catch(() => {}); }, []); // marque lu à l'ouverture

  function go(n: ApiNotification) {
    if (n.type === 'ORDER' && n.orderId) router.push(`/order/${n.orderId}`);
    else if (n.design) router.push(`/design/${n.design.id}`);
    else if (n.type === 'FOLLOW' && n.lastActor) router.push(`/tailor/${n.lastActor.id}`);
  }
  // rendu : <View root><header/><NotificationsList notifications={notifications} onPress={go} /></View>
  // conserver l'état vide si notifications.length === 0
}
```
Vérifier les vrais chemins de routes (`/order/[id]`, `/design/[id]`, `/tailor/[id]`) dans `app/` et adapter.

- [ ] **Step 5 : Lancer les tests + typecheck**

Run : `cd apps/mobile && npm test -- NotificationsList && npm run typecheck`
Expected : PASS.

- [ ] **Step 6 : Commit**

```bash
git add apps/mobile/src/notifications/NotificationsList.tsx apps/mobile/app/notifications.tsx apps/mobile/src/notifications/NotificationsList.test.tsx
git commit -m "feat(mobile): écran Notifications réel (liste, mark-all-read, navigation)"
```

---

## Task 12: Mobile — pastille non-lu sur la cloche

**Files:**
- Modify: `apps/mobile/src/ui/AppHeader.tsx`
- Test: `apps/mobile/src/ui/AppHeader.test.tsx`

**Interfaces:**
- Consumes: `useUnreadCount`.
- Produces: pastille (testID `header-unread-dot`) visible ssi `count > 0`.

- [ ] **Step 1 : Écrire le test qui échoue**

```tsx
// apps/mobile/src/ui/AppHeader.test.tsx
import { render, screen } from '@testing-library/react-native';
import { AppHeader } from './AppHeader';
import { useUnreadCount } from '../notifications/hooks';
import { useAuth } from '../auth/AuthContext';

jest.mock('../notifications/hooks');
jest.mock('../auth/AuthContext');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockedUnread = useUnreadCount as jest.MockedFunction<typeof useUnreadCount>;
const mockedAuth = useAuth as jest.MockedFunction<typeof useAuth>;

beforeEach(() => {
  mockedAuth.mockReturnValue({ user: { id: 'u1', role: 'CLIENT' } } as ReturnType<typeof useAuth>);
});

describe('AppHeader pastille', () => {
  it('montre la pastille quand des notifs non lues existent', () => {
    mockedUnread.mockReturnValue({ count: 3, refetch: jest.fn() });
    render(<AppHeader />);
    expect(screen.getByTestId('header-unread-dot')).toBeTruthy();
  });
  it('cache la pastille quand count=0', () => {
    mockedUnread.mockReturnValue({ count: 0, refetch: jest.fn() });
    render(<AppHeader />);
    expect(screen.queryByTestId('header-unread-dot')).toBeNull();
  });
});
```
Adapter le mock `useAuth` à la vraie forme de `AuthValue` (champs requis) pour satisfaire le typecheck du test.

- [ ] **Step 2 : Lancer le test — il échoue**

Run : `cd apps/mobile && npm test -- AppHeader`
Expected : FAIL (pas de pastille).

- [ ] **Step 3 : Ajouter la pastille**

Dans `AppHeader.tsx` : importer `useUnreadCount`, l’appeler, et superposer un point sur la cloche.
```tsx
import { useUnreadCount } from '../notifications/hooks';
// dans le composant :
const { count } = useUnreadCount();
// remplacer le Pressable cloche par :
<Pressable testID="header-notifications" hitSlop={10} onPress={() => router.push('/notifications')}>
  <Feather name="bell" size={22} color={colors.textOnDark} />
  {count > 0 ? <View testID="header-unread-dot" style={styles.dot} /> : null}
</Pressable>
// ajouter au StyleSheet :
dot: {
  position: 'absolute', top: -2, right: -2,
  width: 10, height: 10, borderRadius: 5,
  backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.ink,
},
```
La cloche a besoin d’un conteneur `position: 'relative'` implicite (Pressable suffit).

- [ ] **Step 4 : Lancer les tests — ils passent**

Run : `cd apps/mobile && npm test -- AppHeader && npm run typecheck`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add apps/mobile/src/ui/AppHeader.tsx apps/mobile/src/ui/AppHeader.test.tsx
git commit -m "feat(mobile): pastille non-lu sur la cloche du header"
```

---

## Task 13: Mobile — enregistrement du jeton push (Expo)

**Files:**
- Create: `apps/mobile/src/notifications/push.ts`
- Modify: `apps/mobile/src/auth/AuthContext.tsx` (register après login, unregister au logout)
- Modify: `apps/mobile/package.json` (dépendance `expo-notifications`)
- Modify: `apps/mobile/app.json` (plugin `expo-notifications` si nécessaire)

**Interfaces:**
- Produces:
  - `registerPushToken(token: string): Promise<void>` — demande permission, récupère l’Expo push token, POST `/me/push-tokens`. Tolérant (Expo Go/refus → no-op silencieux).
  - `unregisterPushToken(token: string): Promise<void>` — DELETE best-effort.
  - `setupNotificationTapHandler(router): () => void` — listener de tap → deep-link (optionnel, best-effort).

- [ ] **Step 1 : Installer la dépendance**

Run :
```bash
cd apps/mobile && npx expo install expo-notifications
```
Expected : `expo-notifications` compatible SDK 54 ajouté au `package.json`.

- [ ] **Step 2 : Implémenter `push.ts` (tolérant, testable en smoke)**

```ts
// apps/mobile/src/notifications/push.ts
import * as Notifications from 'expo-notifications';
import { apiFetch } from '../lib/api';

/** Récupère l'Expo push token (permission + device) puis l'enregistre côté API. Best-effort. */
export async function registerPushToken(authToken: string): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return; // refus : on n'insiste pas
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync();
    if (!expoToken) return;
    await apiFetch('/me/push-tokens', { method: 'POST', body: { token: expoToken }, token: authToken });
  } catch {
    // Expo Go SDK 54 (push retiré) ou toute erreur : silencieux, l'app continue.
  }
}

export async function unregisterPushToken(authToken: string): Promise<void> {
  try {
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync();
    if (!expoToken) return;
    await apiFetch(`/me/push-tokens/${encodeURIComponent(expoToken)}`, { method: 'DELETE', token: authToken });
  } catch {
    // silencieux
  }
}
```

- [ ] **Step 3 : Écrire un smoke test (mock expo-notifications)**

```ts
// apps/mobile/src/notifications/push.test.ts
import { registerPushToken } from './push';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getExpoPushTokenAsync: jest.fn(),
}));

describe('registerPushToken', () => {
  it('ne jette pas et n’enregistre rien si la permission est refusée', async () => {
    await expect(registerPushToken('tok')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4 : Brancher dans `AuthContext`**

Dans `applyAuth` (après un login/register réussi) : `registerPushToken(res.accessToken).catch(() => {});`
Dans `logout` (avant de vider le token) : `if (token) await unregisterPushToken(token).catch(() => {});`
Importer depuis `../notifications/push`.

- [ ] **Step 5 : Lancer les tests + typecheck + bundle**

Run :
```bash
cd apps/mobile && npm test && npm run typecheck
PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx expo export --platform ios
```
Expected : tests verts, typecheck clean, bundle produit (sous node 20).

- [ ] **Step 6 : Commit**

```bash
git add apps/mobile/src/notifications/push.ts apps/mobile/src/notifications/push.test.ts apps/mobile/src/auth/AuthContext.tsx apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/app.json
git commit -m "feat(mobile): enregistrement du jeton Expo Push (tolérant, branché à l'auth)"
```

---

## Task 14: Revue finale de branche + vérification globale

**Files:** aucun code neuf ; vérification + doc.

- [ ] **Step 1 : Suite complète API**

Run : `cd apps/api && npm test && npm run typecheck`
Expected : ~132 tests verts (117 + ~15), typecheck clean.

- [ ] **Step 2 : Suite complète mobile + bundle**

Run :
```bash
cd apps/mobile && npm test && npm run typecheck
PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx expo export --platform ios
```
Expected : ~85 tests verts (75 + ~10), bundle OK.

- [ ] **Step 3 : Vérif manuelle déléguée à Manou (in-app)**

Scénario Expo Go : liker/commenter/suivre avec un 2e compte → l’écran Notifications du 1er compte montre les entrées, la cloche porte la pastille, le tap navigue ; passer une commande → le tailleur reçoit la notif. (Push non testable en Expo Go — normal.)

- [ ] **Step 4 : Mettre à jour le suivi**

Ajouter une ligne à `.superpowers/sdd/progress.md` résumant M4 (tests, décisions : regroupement likes/follows, annulation avant coupe, push câblé no-op).

- [ ] **Step 5 : Commit + PR**

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs: suivi M4 notifications"
```
Puis proposer la PR `mvp1-m4-notifications` → `main`.

---

## Self-Review (couverture spec)

- Modèle `Notification`/`PushToken`/enum → Task 1. ✅
- Regroupement upsert + no-self → Task 2. ✅
- Push Expo best-effort + no-op → Task 3. ✅
- Endpoints lecture (liste/unread/read-all/read) → Task 4. ✅
- Endpoints push-tokens → Task 5. ✅
- 5 déclencheurs (like/comment/reply/follow/order×2) → Tasks 6-7. ✅
- Annulation client avant la coupe + notif tailleur → Task 8. ✅
- Mobile : render, hooks, écran, pastille, push registration → Tasks 9-13. ✅
- Tests API ~15 + mobile ~10 → répartis. ✅
- Contraintes globales (no-self, best-effort, ASCII .ts, node 20) → section Global Constraints + rappels par tâche. ✅

Points à valider par l’implémenteur contre le code réel (notés inline) : nom d’index composé Prisma `recipientId_type_groupKey` ; forme de réponse de `POST /designs/:id/comments` ; champs sélectionnés par `getOwnedOrder` ; tokens du thème mobile ; chemins de routes `/order`, `/design`, `/tailor` ; forme de `AuthValue` pour les mocks de test.
