# M5 — Signalement / blocage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de signaler du contenu/utilisateurs et de bloquer un utilisateur (masquage feed + commentaires, follow coupé), avec un modèle de modération prêt pour un admin futur.

**Architecture:** Backend Express/Prisma : modèles `Report` (admin-ready) et `Block`, module `reports`, module `blocks` (+ helper `getBlockedUserIds`), filtrage du feed et des commentaires, follow refusé si blocage. Mobile Expo/RN : hooks de modération, `ReportSheet` réutilisable, points d'entrée sur détail modèle / commentaire / profil tailleur.

**Tech Stack:** TypeScript, Express, Prisma (PostgreSQL), Vitest + supertest ; Expo/React Native, @tanstack/react-query, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-14-mvp1-m5-signalement-blocage-design.md`

## Global Constraints

- Libellés & messages d'erreur en **français**. Commits conventionnels terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **TDD strict** : test rouge d'abord, puis code minimal. API : `npm run typecheck` + `npm test` verts. Mobile : `npx tsc --noEmit` + `npx jest` verts.
- Base de test API : Postgres `localhost:5433` (docker-compose `db`).
- **Aucun back-office admin dans M5** : les champs `status/resolvedBy*/resolutionNote` existent mais ne sont écrits par aucune route de M5.
- Codes d'erreur : `INTROUVABLE` (404), `ACTION_INVALIDE` (400 auto-cible), `ACTION_IMPOSSIBLE` (403 follow bloqué), `DONNEES_INVALIDES` (400 zod).
- Routers montés dans `apps/api/src/app.ts` via `app.use(...)`.

---

### Task 1: Migration — `Report` + `Block`

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (enums + modèles + relations inverses sur `User`)
- Create: `apps/api/prisma/migrations/<ts>_add_reports_and_blocks/migration.sql` (généré)

**Interfaces:**
- Produces: modèles Prisma `Report`, `Block` ; enums `ReportTargetType`, `ReportReason`, `ReportStatus` ; relations `User.reportsMade/reportsResolved/blocksMade/blockedBy`.

- [ ] **Step 1: Ajouter enums + modèles**

Dans `apps/api/prisma/schema.prisma`, ajouter les enums près des autres enums :

```prisma
enum ReportTargetType { DESIGN COMMENT USER }
enum ReportReason { INAPPROPRIE SPAM PLAGIAT HARCELEMENT AUTRE }
enum ReportStatus { OPEN REVIEWING RESOLVED REJECTED }
```

et les modèles (en bas du fichier) :

```prisma
model Report {
  id             String           @id @default(cuid())
  reporterId     String
  reporter       User             @relation("reportsMade", fields: [reporterId], references: [id], onDelete: Cascade)
  targetType     ReportTargetType
  targetId       String
  reason         ReportReason
  details        String?
  status         ReportStatus     @default(OPEN)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  resolvedById   String?
  resolvedBy     User?            @relation("reportsResolved", fields: [resolvedById], references: [id], onDelete: SetNull)
  resolvedAt     DateTime?
  resolutionNote String?

  @@unique([reporterId, targetType, targetId])
  @@index([status])
  @@index([targetType, targetId])
  @@map("reports")
}

model Block {
  id        String   @id @default(cuid())
  blockerId String
  blocker   User     @relation("blocksMade", fields: [blockerId], references: [id], onDelete: Cascade)
  blockedId String
  blocked   User     @relation("blockedBy", fields: [blockedId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([blockerId, blockedId])
  @@index([blockedId])
  @@map("blocks")
}
```

- [ ] **Step 2: Relations inverses sur `User`**

Dans le modèle `User`, ajouter :

```prisma
  reportsMade     Report[] @relation("reportsMade")
  reportsResolved Report[] @relation("reportsResolved")
  blocksMade      Block[]  @relation("blocksMade")
  blockedBy       Block[]  @relation("blockedBy")
```

- [ ] **Step 3: Générer la migration**

Run:
```bash
cd apps/api && npx dotenv-cli -e .env.test -- npx prisma migrate dev --name add_reports_and_blocks
```
Expected: migration créée + appliquée, client régénéré. (DB up : `docker compose up -d db`.)

- [ ] **Step 4: Typecheck**

Run: `cd apps/api && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): modèles Report + Block (modération M5, admin-ready)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Signalement — `POST /reports`

**Files:**
- Create: `apps/api/src/modules/reports/reports.service.ts`
- Create: `apps/api/src/modules/reports/reports.routes.ts`
- Modify: `apps/api/src/app.ts` (import + `app.use('/reports', reportsRouter)`)
- Test: `apps/api/tests/reports.test.ts`

**Interfaces:**
- Consumes: modèle `Report` (Task 1).
- Produces: `POST /reports { targetType, targetId, reason, details? }` → 201 `{ report }` (ou 200 `{ report, alreadyReported: true }`) ; `ensureReportTargetExists(type, id)`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/api/tests/reports.test.ts`:

```typescript
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

async function publish(token: string) {
  const res = await request(app)
    .post('/designs')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'A')
    .field('category', 'BOUBOU')
    .attach('media', await makeTestImage(), 'm.jpg');
  return res.body.design.id as string;
}

describe('POST /reports (M5)', () => {
  it('signale un modèle (201)', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770006001');
    const designId = await publish(tailor);
    const { token: client } = await registerUser(app, 'CLIENT', '+221770006002');
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${client}`)
      .send({ targetType: 'DESIGN', targetId: designId, reason: 'INAPPROPRIE' });
    expect(res.status).toBe(201);
    expect(res.body.report.status).toBe('OPEN');
  });

  it('signale un utilisateur (201) mais refuse soi-même (400)', async () => {
    const { token, user } = await registerUser(app, 'CLIENT', '+221770006003');
    const { user: other } = await registerUser(app, 'TAILLEUR', '+221770006004');
    const ok = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'USER', targetId: other.id, reason: 'HARCELEMENT' });
    expect(ok.status).toBe(201);
    const self = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'USER', targetId: user.id, reason: 'SPAM' });
    expect(self.status).toBe(400);
  });

  it('idempotent : 2ᵉ signalement identique → 200', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770006005');
    const designId = await publish(tailor);
    const { token: client } = await registerUser(app, 'CLIENT', '+221770006006');
    const body = { targetType: 'DESIGN', targetId: designId, reason: 'SPAM' };
    await request(app).post('/reports').set('Authorization', `Bearer ${client}`).send(body);
    const dup = await request(app).post('/reports').set('Authorization', `Bearer ${client}`).send(body);
    expect(dup.status).toBe(200);
    expect(dup.body.alreadyReported).toBe(true);
  });

  it('404 si la cible n’existe pas', async () => {
    const { token } = await registerUser(app, 'CLIENT', '+221770006007');
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'DESIGN', targetId: 'inexistant', reason: 'AUTRE' });
    expect(res.status).toBe(404);
  });

  it('400 si reason invalide', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770006008');
    const designId = await publish(tailor);
    const { token } = await registerUser(app, 'CLIENT', '+221770006009');
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'DESIGN', targetId: designId, reason: 'PAS_UNE_RAISON' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/api && npx vitest run tests/reports.test.ts`
Expected: FAIL (route inexistante → 404 partout).

- [ ] **Step 3: Implémenter le service**

Créer `apps/api/src/modules/reports/reports.service.ts`:

```typescript
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export type ReportTargetType = 'DESIGN' | 'COMMENT' | 'USER';

export async function ensureReportTargetExists(type: ReportTargetType, id: string): Promise<void> {
  const exists =
    type === 'DESIGN'
      ? await prisma.design.findUnique({ where: { id }, select: { id: true } })
      : type === 'COMMENT'
        ? await prisma.comment.findUnique({ where: { id }, select: { id: true } })
        : await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    throw new ApiError(404, 'INTROUVABLE', 'Contenu introuvable.');
  }
}
```

- [ ] **Step 4: Implémenter la route**

Créer `apps/api/src/modules/reports/reports.routes.ts`:

```typescript
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { ensureReportTargetExists } from './reports.service.js';

export const reportsRouter = Router();

const reportSchema = z.object({
  targetType: z.enum(['DESIGN', 'COMMENT', 'USER']),
  targetId: z.string().min(1),
  reason: z.enum(['INAPPROPRIE', 'SPAM', 'PLAGIAT', 'HARCELEMENT', 'AUTRE']),
  details: z.string().max(500).optional(),
});

reportsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const { targetType, targetId, reason, details } = parsed.data;
  const reporterId = req.user!.sub;
  if (targetType === 'USER' && targetId === reporterId) {
    throw new ApiError(400, 'ACTION_INVALIDE', 'Tu ne peux pas te signaler toi-même.');
  }
  await ensureReportTargetExists(targetType, targetId);
  try {
    const report = await prisma.report.create({
      data: { reporterId, targetType, targetId, reason, details },
    });
    res.status(201).json({ report });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const report = await prisma.report.findUnique({
        where: { reporterId_targetType_targetId: { reporterId, targetType, targetId } },
      });
      res.status(200).json({ report, alreadyReported: true });
      return;
    }
    throw err;
  }
});
```

- [ ] **Step 5: Monter le router**

Dans `apps/api/src/app.ts` : importer `reportsRouter` et ajouter `app.use('/reports', reportsRouter);` (près des autres `app.use`).

- [ ] **Step 6: Vérifier le succès**

Run: `cd apps/api && npx vitest run tests/reports.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/reports apps/api/src/app.ts apps/api/tests/reports.test.ts
git commit -m "feat(api): signalement POST /reports (DESIGN/COMMENT/USER, idempotent) (M5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Blocage — routes + helper `getBlockedUserIds`

**Files:**
- Create: `apps/api/src/modules/blocks/blocks.service.ts`
- Create: `apps/api/src/modules/blocks/blocks.routes.ts`
- Modify: `apps/api/src/app.ts` (import + `app.use(blocksRouter)`)
- Test: `apps/api/tests/blocks.test.ts`

**Interfaces:**
- Consumes: modèles `Block`, `Follow` (Task 1 + existant).
- Produces:
  - `getBlockedUserIds(viewerId: string): Promise<string[]>` (bidirectionnel ; `[]` si viewer vide).
  - `POST /users/:id/block` (204), `DELETE /users/:id/block` (204), `GET /me/blocks` → `{ blockedIds: string[] }`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/api/tests/blocks.test.ts`:

```typescript
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Blocage (M5)', () => {
  it('bloque, liste, débloque', async () => {
    const { token: a } = await registerUser(app, 'CLIENT', '+221770007001');
    const { user: b } = await registerUser(app, 'TAILLEUR', '+221770007002');

    const block = await request(app).post(`/users/${b.id}/block`).set(auth(a));
    expect(block.status).toBe(204);

    const list = await request(app).get('/me/blocks').set(auth(a));
    expect(list.body.blockedIds).toContain(b.id);

    const unblock = await request(app).delete(`/users/${b.id}/block`).set(auth(a));
    expect(unblock.status).toBe(204);
    const list2 = await request(app).get('/me/blocks').set(auth(a));
    expect(list2.body.blockedIds).not.toContain(b.id);
  });

  it('refuse de se bloquer soi-même (400)', async () => {
    const { token, user } = await registerUser(app, 'CLIENT', '+221770007003');
    const res = await request(app).post(`/users/${user.id}/block`).set(auth(token));
    expect(res.status).toBe(400);
  });

  it('404 si la cible est inconnue', async () => {
    const { token } = await registerUser(app, 'CLIENT', '+221770007004');
    const res = await request(app).post('/users/inexistant/block').set(auth(token));
    expect(res.status).toBe(404);
  });

  it('bloquer supprime les follows croisés', async () => {
    const { token: a, user: ua } = await registerUser(app, 'CLIENT', '+221770007005');
    const { token: b, user: ub } = await registerUser(app, 'TAILLEUR', '+221770007006');
    await request(app).post(`/tailors/${ub.id}/follow`).set(auth(a)); // a suit b
    await request(app).post(`/users/${ub.id}/block`).set(auth(a));    // a bloque b

    const following = await request(app).get('/designs?following=1').set(auth(a));
    expect(following.status).toBe(200);
    // a ne suit plus b : le feed abonnements ne contient aucun modèle de b (ici vide).
    expect(following.body.designs.length).toBe(0);
    void ua;
    void b;
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/api && npx vitest run tests/blocks.test.ts`
Expected: FAIL (routes inexistantes).

- [ ] **Step 3: Implémenter le service**

Créer `apps/api/src/modules/blocks/blocks.service.ts`:

```typescript
import { prisma } from '../../lib/prisma.js';

/** Ids en relation de blocage avec le viewer, dans les deux sens. */
export async function getBlockedUserIds(viewerId: string): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.blockerId === viewerId ? r.blockedId : r.blockerId);
  return [...ids];
}
```

- [ ] **Step 4: Implémenter les routes**

Créer `apps/api/src/modules/blocks/blocks.routes.ts`:

```typescript
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const blocksRouter = Router();

blocksRouter.get('/me/blocks', requireAuth, async (req, res) => {
  const rows = await prisma.block.findMany({
    where: { blockerId: req.user!.sub },
    select: { blockedId: true },
  });
  res.json({ blockedIds: rows.map((r) => r.blockedId) });
});

blocksRouter.post('/users/:id/block', requireAuth, async (req, res) => {
  const blockedId = req.params.id as string;
  const blockerId = req.user!.sub;
  if (blockedId === blockerId) {
    throw new ApiError(400, 'ACTION_INVALIDE', 'Tu ne peux pas te bloquer toi-même.');
  }
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) throw new ApiError(404, 'INTROUVABLE', 'Utilisateur introuvable.');
  try {
    await prisma.block.create({ data: { blockerId, blockedId } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    // Déjà bloqué : idempotent.
  }
  // Couper les follows dans les deux sens.
  await prisma.follow.deleteMany({
    where: {
      OR: [
        { followerId: blockerId, tailorId: blockedId },
        { followerId: blockedId, tailorId: blockerId },
      ],
    },
  });
  res.status(204).send();
});

blocksRouter.delete('/users/:id/block', requireAuth, async (req, res) => {
  await prisma.block.deleteMany({
    where: { blockerId: req.user!.sub, blockedId: req.params.id as string },
  });
  res.status(204).send();
});
```

- [ ] **Step 5: Monter le router**

Dans `apps/api/src/app.ts` : importer `blocksRouter` et ajouter `app.use(blocksRouter);` **avant** `app.use(usersRouter)` (ordre sans importance ici, chemins distincts).

- [ ] **Step 6: Vérifier le succès**

Run: `cd apps/api && npx vitest run tests/blocks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/blocks apps/api/src/app.ts apps/api/tests/blocks.test.ts
git commit -m "feat(api): blocage utilisateur (block/unblock, /me/blocks) + coupe les follows (M5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Application du blocage (feed + commentaires + follow)

**Files:**
- Modify: `apps/api/src/modules/designs/designs.routes.ts` (handler `GET /`)
- Modify: `apps/api/src/modules/designs/designs.service.ts` (`getForYouFeed`, `getThreadedComments`)
- Modify: `apps/api/src/modules/tailors/tailors.routes.ts` (follow)
- Test: `apps/api/tests/blocks-effects.test.ts`

**Interfaces:**
- Consumes: `getBlockedUserIds` (Task 3).
- Produces: feed, commentaires et follow tiennent compte du blocage.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/api/tests/blocks-effects.test.ts`:

```typescript
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function publish(token: string, title: string) {
  const res = await request(app)
    .post('/designs')
    .set(auth(token))
    .field('title', title)
    .field('category', 'BOUBOU')
    .attach('media', await makeTestImage(), 'm.jpg');
  return res.body.design.id as string;
}

describe('Effets du blocage (M5)', () => {
  it('le feed exclut les modèles d’un tailleur bloqué', async () => {
    const { token: tailor, user: t } = await registerUser(app, 'TAILLEUR', '+221770008001');
    await publish(tailor, 'Modele bloque');
    const { token: viewer } = await registerUser(app, 'CLIENT', '+221770008002');

    const before = await request(app).get('/designs').set(auth(viewer));
    expect(before.body.designs.some((d: { id: string }) => d.id)).toBe(true);

    await request(app).post(`/users/${t.id}/block`).set(auth(viewer));
    const after = await request(app).get('/designs').set(auth(viewer));
    expect(after.body.designs.length).toBe(0);
  });

  it('les commentaires d’un utilisateur bloqué sont masqués', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770008003');
    const designId = await publish(tailor, 'A');
    const { token: viewer } = await registerUser(app, 'CLIENT', '+221770008004');
    const { token: troll, user: trollUser } = await registerUser(app, 'CLIENT', '+221770008005');
    await request(app).post(`/designs/${designId}/comments`).set(auth(troll)).send({ text: 'spam' });

    const withComment = await request(app).get(`/designs/${designId}`).set(auth(viewer));
    expect(withComment.body.comments.length).toBe(1);

    await request(app).post(`/users/${trollUser.id}/block`).set(auth(viewer));
    const hidden = await request(app).get(`/designs/${designId}`).set(auth(viewer));
    expect(hidden.body.comments.length).toBe(0);
  });

  it('suivre un utilisateur bloqué est refusé (403)', async () => {
    const { token: viewer } = await registerUser(app, 'CLIENT', '+221770008006');
    const { user: t } = await registerUser(app, 'TAILLEUR', '+221770008007');
    await request(app).post(`/users/${t.id}/block`).set(auth(viewer));
    const follow = await request(app).post(`/tailors/${t.id}/follow`).set(auth(viewer));
    expect(follow.status).toBe(403);
  });
});
```

> Note : l'endpoint de création de commentaire est `POST /designs/:id/comments` et le détail `GET /designs/:id` renvoie `comments`. Vérifier ces chemins dans `designs.routes.ts` avant d'écrire le test ; adapter si nécessaire.

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/api && npx vitest run tests/blocks-effects.test.ts`
Expected: FAIL (blocage non appliqué).

- [ ] **Step 3: Feed — handler `GET /` (`designs.routes.ts`)**

Importer le helper : `import { getBlockedUserIds } from '../blocks/blocks.service.js';`

Dans le handler `GET /`, calculer une fois `const blockedIds = await getBlockedUserIds(viewerId);` (après le calcul de `viewerId`). Puis :
- Ajouter `if (blockedIds.length) where.tailorId = { ...(where.tailorId as object ?? {}), notIn: blockedIds };` — attention à ne pas écraser le `where.tailorId` posé par `following`. Concrètement, après le bloc `if (isFollowing) { ... where.tailorId = { in: [...] }; }`, faire :

```typescript
  if (blockedIds.length) {
    where.tailorId =
      where.tailorId && typeof where.tailorId === 'object'
        ? { ...(where.tailorId as Record<string, unknown>), notIn: blockedIds }
        : { notIn: blockedIds };
  }
```
- Passer `blockedIds` à `getForYouFeed({ viewerId, interests: me.interests, limit, cursor, blockedIds })`.
- Le `findMany` du mode curseur utilise déjà `where` (donc couvert). Idem mode offset (recherche) : `where` couvert.

- [ ] **Step 4: `getForYouFeed` (`designs.service.ts`)**

Ajouter `blockedIds: string[]` aux params. Dans `fetchPhase`, changer le `where` :

```typescript
    const category = ph === 'p' ? { in: interests } : { notIn: interests };
    return prisma.design.findMany({
      where: { category, ...(blockedIds.length ? { tailorId: { notIn: blockedIds } } : {}) },
      ...
    });
```

- [ ] **Step 5: `getThreadedComments` (`designs.service.ts`)**

Calculer `const blockedIds = await getBlockedUserIds(viewerId);` en tête, puis ajouter le filtre aux racines et aux réponses :

```typescript
  const notBlocked = blockedIds.length ? { userId: { notIn: blockedIds } } : {};
  const roots = await prisma.comment.findMany({
    where: { designId, parentId: null, ...notBlocked },
    ...
      replies: {
        where: notBlocked,
        orderBy: { createdAt: 'asc' },
        ...
      },
  });
```
Importer `getBlockedUserIds` dans `designs.service.ts`.

- [ ] **Step 6: Follow refusé si blocage (`tailors.routes.ts`)**

Dans `POST /:id/follow`, après le check « toi-même » et `ensureTailorExists`, ajouter :

```typescript
  const blocked = await getBlockedUserIds(req.user!.sub);
  if (blocked.includes(tailorId)) {
    throw new ApiError(403, 'ACTION_IMPOSSIBLE', 'Action impossible : cet utilisateur est bloqué.');
  }
```
Importer `getBlockedUserIds`.

- [ ] **Step 7: Vérifier le succès**

Run: `cd apps/api && npx vitest run tests/blocks-effects.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Vérif globale API + commit**

Run: `cd apps/api && npm run typecheck && npm test`
Expected: suite complète verte.

```bash
git add apps/api/src/modules/designs apps/api/src/modules/tailors/tailors.routes.ts apps/api/tests/blocks-effects.test.ts
git commit -m "feat(api): applique le blocage au feed, aux commentaires et au follow (M5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Mobile — hooks de modération

**Files:**
- Create: `apps/mobile/src/moderation/hooks.ts`
- Create: `apps/mobile/src/moderation/reasons.ts`
- Test: `apps/mobile/src/moderation/hooks.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `useAuth`.
- Produces:
  - `type ReportTargetType = 'DESIGN' | 'COMMENT' | 'USER'`, `type ReportReason = ...`.
  - `REPORT_REASONS: { value: ReportReason; label: string }[]`.
  - `useReport(): { report(input): Promise<unknown>; sending: boolean }`.
  - `useBlock()`, `useUnblock()`, `useBlockedIds(): { blockedIds: string[]; isBlocked(id): boolean }`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/mobile/src/moderation/hooks.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useBlock, useReport } from './hooks';

jest.mock('../lib/api');
jest.mock('../auth/AuthContext');
const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
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
  mockedFetch.mockResolvedValue({} as never);
});

it('useReport POST /reports', async () => {
  const { result } = renderHook(() => useReport(), { wrapper: wrapper() });
  await act(async () => {
    await result.current.report({ targetType: 'DESIGN', targetId: 'd1', reason: 'SPAM' });
  });
  expect(mockedFetch).toHaveBeenCalledWith(
    '/reports',
    expect.objectContaining({ method: 'POST', token: 'tok', body: { targetType: 'DESIGN', targetId: 'd1', reason: 'SPAM' } }),
  );
});

it('useBlock POST /users/:id/block', async () => {
  const { result } = renderHook(() => useBlock(), { wrapper: wrapper() });
  await act(async () => {
    await result.current.block('u1');
  });
  expect(mockedFetch).toHaveBeenCalledWith(
    '/users/u1/block',
    expect.objectContaining({ method: 'POST', token: 'tok' }),
  );
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/mobile && npx jest src/moderation/hooks.test.tsx`
Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter `reasons.ts`**

Créer `apps/mobile/src/moderation/reasons.ts`:

```typescript
export type ReportReason = 'INAPPROPRIE' | 'SPAM' | 'PLAGIAT' | 'HARCELEMENT' | 'AUTRE';
export type ReportTargetType = 'DESIGN' | 'COMMENT' | 'USER';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'INAPPROPRIE', label: 'Contenu inapproprié' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'PLAGIAT', label: 'Plagiat' },
  { value: 'HARCELEMENT', label: 'Harcèlement' },
  { value: 'AUTRE', label: 'Autre' },
];
```

- [ ] **Step 4: Implémenter `hooks.ts`**

Créer `apps/mobile/src/moderation/hooks.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ReportReason, ReportTargetType } from './reasons';

type ReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
};

export function useReport() {
  const { token } = useAuth();
  const m = useMutation({
    mutationFn: (input: ReportInput) => apiFetch('/reports', { method: 'POST', token, body: input }),
  });
  return { report: (input: ReportInput) => m.mutateAsync(input), sending: m.isPending };
}

function useBlockMutation(method: 'POST' | 'DELETE') {
  const { token } = useAuth();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (userId: string) => apiFetch(`/users/${userId}/block`, { method, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocks'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['tailor'] });
    },
  });
  return m;
}

export function useBlock() {
  const m = useBlockMutation('POST');
  return { block: (userId: string) => m.mutateAsync(userId), blocking: m.isPending };
}

export function useUnblock() {
  const m = useBlockMutation('DELETE');
  return { unblock: (userId: string) => m.mutateAsync(userId), unblocking: m.isPending };
}

export function useBlockedIds() {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ['blocks'],
    enabled: Boolean(token),
    queryFn: () => apiFetch<{ blockedIds: string[] }>('/me/blocks', { token }),
  });
  const blockedIds = q.data?.blockedIds ?? [];
  return { blockedIds, isBlocked: (id: string) => blockedIds.includes(id) };
}
```

- [ ] **Step 5: Vérifier le succès**

Run: `cd apps/mobile && npx jest src/moderation/hooks.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/moderation
git commit -m "feat(mobile): hooks modération (useReport, useBlock/Unblock, useBlockedIds) (M5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Mobile — composant `ReportSheet`

**Files:**
- Create: `apps/mobile/src/moderation/ReportSheet.tsx`
- Test: `apps/mobile/src/moderation/ReportSheet.test.tsx`

**Interfaces:**
- Consumes: `useReport` (Task 5), `REPORT_REASONS`.
- Produces: `<ReportSheet visible targetType targetId onClose />` — modal de choix de raison qui appelle `report()` puis `onClose`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/mobile/src/moderation/ReportSheet.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ReportSheet } from './ReportSheet';
import { useReport } from './hooks';

jest.mock('./hooks');
const reportFn = jest.fn().mockResolvedValue({});
(useReport as jest.Mock).mockReturnValue({ report: reportFn, sending: false });

it('envoie le signalement avec la raison choisie', async () => {
  const onClose = jest.fn();
  render(<ReportSheet visible targetType="DESIGN" targetId="d1" onClose={onClose} />);
  fireEvent.press(screen.getByText('Spam'));
  await waitFor(() =>
    expect(reportFn).toHaveBeenCalledWith({ targetType: 'DESIGN', targetId: 'd1', reason: 'SPAM' }),
  );
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/mobile && npx jest src/moderation/ReportSheet.test.tsx`
Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter `ReportSheet`**

Créer `apps/mobile/src/moderation/ReportSheet.tsx` : un `Modal` (RN) transparent, thème sombre, listant `REPORT_REASONS`. Au press d'une raison : `await report({ targetType, targetId, reason }); onClose();` (avaler l'erreur avec un message). Signature :

```tsx
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useReport } from './hooks';
import { REPORT_REASONS, type ReportTargetType } from './reasons';

type Props = {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
};

export function ReportSheet({ visible, targetType, targetId, onClose }: Props) {
  const { report, sending } = useReport();
  async function choose(reason: (typeof REPORT_REASONS)[number]['value']) {
    try {
      await report({ targetType, targetId, reason });
    } finally {
      onClose();
    }
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Signaler</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable key={r.value} style={styles.row} disabled={sending} onPress={() => choose(r.value)}>
              <Text style={styles.rowText}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.inkElevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  title: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17, marginBottom: spacing.md },
  row: { paddingVertical: spacing.md },
  rowText: { color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
});
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd apps/mobile && npx jest src/moderation/ReportSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/moderation/ReportSheet.tsx apps/mobile/src/moderation/ReportSheet.test.tsx
git commit -m "feat(mobile): ReportSheet (feuille de signalement réutilisable) (M5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Mobile — câblage profil tailleur (bloquer / signaler)

**Files:**
- Modify: `apps/mobile/app/tailor/[id].tsx`
- Test: `apps/mobile/src/moderation/blockButton.test.tsx` (test d'un petit composant extrait) OU test d'intégration léger

**Interfaces:**
- Consumes: `useBlock`, `useUnblock`, `useBlockedIds`, `ReportSheet`.
- Produces: sur le profil tailleur, un bouton **Bloquer/Débloquer** (état via `useBlockedIds`) et une entrée **Signaler**.

- [ ] **Step 1: Écrire le test qui échoue**

Pour rester testable simplement, extraire un composant `BlockButton` dans `apps/mobile/src/moderation/BlockButton.tsx` et le tester. Créer `apps/mobile/src/moderation/BlockButton.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BlockButton } from './BlockButton';
import { useBlock, useUnblock, useBlockedIds } from './hooks';

jest.mock('./hooks');
const block = jest.fn().mockResolvedValue({});
const unblock = jest.fn().mockResolvedValue({});
(useBlock as jest.Mock).mockReturnValue({ block, blocking: false });
(useUnblock as jest.Mock).mockReturnValue({ unblock, unblocking: false });

it('affiche Bloquer puis appelle block', () => {
  (useBlockedIds as jest.Mock).mockReturnValue({ blockedIds: [], isBlocked: () => false });
  render(<BlockButton userId="u1" />);
  fireEvent.press(screen.getByText('Bloquer'));
  expect(block).toHaveBeenCalledWith('u1');
});

it('affiche Débloquer quand déjà bloqué', () => {
  (useBlockedIds as jest.Mock).mockReturnValue({ blockedIds: ['u1'], isBlocked: (id: string) => id === 'u1' });
  render(<BlockButton userId="u1" />);
  expect(screen.getByText('Débloquer')).toBeTruthy();
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/mobile && npx jest src/moderation/BlockButton.test.tsx`
Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter `BlockButton`**

Créer `apps/mobile/src/moderation/BlockButton.tsx`:

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useBlock, useBlockedIds, useUnblock } from './hooks';

export function BlockButton({ userId }: { userId: string }) {
  const { isBlocked } = useBlockedIds();
  const { block, blocking } = useBlock();
  const { unblock, unblocking } = useUnblock();
  const blocked = isBlocked(userId);
  return (
    <Pressable
      style={styles.btn}
      disabled={blocking || unblocking}
      onPress={() => (blocked ? unblock(userId) : block(userId))}
    >
      <Text style={styles.text}>{blocked ? 'Débloquer' : 'Bloquer'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inkLine,
  },
  text: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
});
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd apps/mobile && npx jest src/moderation/BlockButton.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Câbler dans `tailor/[id].tsx`**

Sous le bouton « Suivre » (visible si `canFollow`), rendre `<BlockButton userId={tailor.id} />` et une entrée « Signaler » ouvrant un `ReportSheet` (`targetType="USER"`, `targetId={tailor.id}`) via un état local `reportOpen`.

- [ ] **Step 6: Typecheck + commit**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS.

```bash
git add apps/mobile/src/moderation/BlockButton.tsx apps/mobile/src/moderation/BlockButton.test.tsx "apps/mobile/app/tailor/[id].tsx"
git commit -m "feat(mobile): bloquer/débloquer + signaler sur le profil tailleur (M5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Mobile — signaler sur le détail modèle & le commentaire

**Files:**
- Modify: `apps/mobile/src/design/DesignScreen.tsx` (menu « ⋯ » → signaler le modèle / le tailleur, bloquer le tailleur)
- Modify: `apps/mobile/src/design/CommentItem.tsx` (action « Signaler »)
- Test: réutilise `ReportSheet.test.tsx` (déjà couvert) ; ajouter au besoin un test de présence du déclencheur

**Interfaces:**
- Consumes: `ReportSheet`, `BlockButton`/`useBlock`.
- Produces: points d'entrée signalement sur modèle et commentaire.

- [ ] **Step 1: Lire les composants cibles**

Lire `apps/mobile/src/design/DesignScreen.tsx` et `apps/mobile/src/design/CommentItem.tsx` pour repérer l'en-tête (bouton « ⋯ ») et la barre d'actions d'un commentaire.

- [ ] **Step 2: Détail modèle**

Ajouter dans `DesignScreen.tsx` un bouton « ⋯ » (icône `more-horizontal`) qui ouvre un petit menu (Modal/action sheet) avec : « Signaler le modèle » (`ReportSheet` `DESIGN`/`design.id`), « Signaler le tailleur » (`USER`/`design.tailor.id`), « Bloquer le tailleur » (`useBlock().block(design.tailor.id)`). Gérer l'état d'ouverture localement.

- [ ] **Step 3: Commentaire**

Dans `CommentItem.tsx`, ajouter une action « Signaler » (appui long ou petite icône) ouvrant `ReportSheet` (`COMMENT`/`comment.id`).

- [ ] **Step 4: Vérif globale mobile**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: suites vertes.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/design/DesignScreen.tsx apps/mobile/src/design/CommentItem.tsx
git commit -m "feat(mobile): signaler modèle/tailleur/commentaire + bloquer depuis le détail (M5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes d'exécution

- **Ordre** : Tasks 1→4 (backend), 5→8 (mobile). Task 4 dépend du helper de Task 3.
- **Base de test API** : Postgres `localhost:5433` requis (libérer le port si un autre projet l'occupe, restaurer après).
- **Vérifier avant Task 4** : chemins exacts de création de commentaire et du détail (`POST /designs/:id/comments`, `GET /designs/:id` → `comments`) dans `designs.routes.ts`.
- **Design** : Tasks 6-8 = surfaces sociales ; garder le thème sombre existant.
