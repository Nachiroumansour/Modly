# Jalon 1 — Fondations & Authentification : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le monorepo Moodly (package partagé + API Express + PostgreSQL/Prisma) avec l'authentification complète par téléphone : inscription, connexion, refresh token, middleware de rôles.

**Architecture:** Monorepo npm workspaces. `packages/shared` porte les constantes métier (15 mesures, catégories, statuts). `apps/api` est une API Express 5 + TypeScript, Prisma sur PostgreSQL (Docker local, port 5433), erreurs normalisées `{ error: { code, message } }`, JWT access (15 min) + refresh (30 j).

**Tech Stack:** Node.js ≥ 20, npm workspaces, TypeScript strict, Express 5, Prisma, PostgreSQL 16 (Docker), zod v3, bcryptjs, jsonwebtoken, Vitest + Supertest, tsx.

**Spec:** `docs/superpowers/specs/2026-07-03-moodly-mvp-design.md`

## Global Constraints

- Node ≥ 20, TypeScript `strict: true` partout, modules ESM (`"type": "module"`, imports avec extension `.js`).
- Tous les messages d'erreur exposés à l'utilisateur sont en **français simple**.
- Format d'erreur API unique : `{ error: { code, message } }` — codes en MAJUSCULES_FRANCAISES (ex. `TELEPHONE_DEJA_UTILISE`).
- Rôles : `TAILLEUR` | `CLIENT`. Connexion par **téléphone** (regex `^\+?[0-9]{7,15}$`), email optionnel.
- Postgres dev : base `moodly`, port hôte **5433**. Tests : base `moodly_test`, mêmes identifiants (`moodly`/`moodly`).
- Ne jamais renvoyer `passwordHash` dans une réponse API.
- Commits fréquents : un commit par cycle test-vert, préfixes `feat:`, `test:`, `chore:`.
- Tous les fichiers de ce plan sont relatifs à la racine du repo : `/Users/macbook_1/devperso/Moodly`.

---

### Task 1: Monorepo + package partagé `@moodly/shared`

**Files:**
- Create: `package.json` (racine)
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/index.test.ts`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: package `@moodly/shared` exportant `ROLES`, `Role`, `DESIGN_CATEGORIES`, `DesignCategory`, `ORDER_STATUSES`, `OrderStatus`, `PAYMENT_STATUSES`, `PaymentStatus`, `MEASUREMENT_FIELDS` (15 entrées `{ key, label }`), `MeasurementKey`. Les tâches suivantes importent depuis `@moodly/shared`.

- [ ] **Step 1: Créer la structure du monorepo**

`package.json` (racine) :

```json
{
  "name": "moodly",
  "private": true,
  "engines": { "node": ">=20" },
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "test": "npm test --workspaces --if-present",
    "dev:api": "npm run dev -w apps/api"
  }
}
```

`tsconfig.base.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

`packages/shared/package.json` :

```json
{
  "name": "@moodly/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run" }
}
```

`packages/shared/tsconfig.json` :

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Puis installer vitest :

```bash
cd /Users/macbook_1/devperso/Moodly
npm install -D vitest typescript -w packages/shared
```

- [ ] **Step 2: Écrire le test qui échoue**

`packages/shared/src/index.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import {
  DESIGN_CATEGORIES,
  MEASUREMENT_FIELDS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  ROLES,
} from './index.js';

describe('constantes partagées Moodly', () => {
  it('définit exactement 15 mesures avec des clés uniques et des libellés français', () => {
    expect(MEASUREMENT_FIELDS).toHaveLength(15);
    const keys = MEASUREMENT_FIELDS.map((m) => m.key);
    expect(new Set(keys).size).toBe(15);
    for (const field of MEASUREMENT_FIELDS) {
      expect(field.label.length).toBeGreaterThan(2);
    }
  });

  it('définit les rôles, catégories et statuts du cahier des charges', () => {
    expect(ROLES).toEqual(['TAILLEUR', 'CLIENT']);
    expect(DESIGN_CATEGORIES).toHaveLength(8);
    expect(DESIGN_CATEGORIES).toContain('TABASKI');
    expect(ORDER_STATUSES).toEqual([
      'EN_ATTENTE',
      'TISSU_RECU',
      'COUPE',
      'COUTURE',
      'FINITIONS',
      'PRET',
      'LIVREE',
      'ANNULEE',
    ]);
    expect(PAYMENT_STATUSES).toEqual(['EN_ATTENTE', 'ACOMPTE', 'PAYE']);
  });
});
```

- [ ] **Step 3: Vérifier que le test échoue**

Run: `npm test -w packages/shared`
Expected: FAIL — `Cannot find module './index.js'` (ou équivalent).

- [ ] **Step 4: Implémenter `index.ts`**

`packages/shared/src/index.ts` :

```ts
export const ROLES = ['TAILLEUR', 'CLIENT'] as const;
export type Role = (typeof ROLES)[number];

export const DESIGN_CATEGORIES = [
  'BOUBOU',
  'ROBE',
  'ENSEMBLE',
  'ENFANT',
  'MARIAGE',
  'TABASKI',
  'KORITE',
  'MAGAL',
] as const;
export type DesignCategory = (typeof DESIGN_CATEGORIES)[number];

export const ORDER_STATUSES = [
  'EN_ATTENTE',
  'TISSU_RECU',
  'COUPE',
  'COUTURE',
  'FINITIONS',
  'PRET',
  'LIVREE',
  'ANNULEE',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['EN_ATTENTE', 'ACOMPTE', 'PAYE'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MEASUREMENT_FIELDS = [
  { key: 'tourPoitrine', label: 'Tour de poitrine' },
  { key: 'tourTaille', label: 'Tour de taille' },
  { key: 'tourHanches', label: 'Tour de hanches' },
  { key: 'largeurEpaules', label: "Largeur d'épaules" },
  { key: 'longueurBras', label: 'Longueur de bras' },
  { key: 'tourBras', label: 'Tour de bras' },
  { key: 'tourCou', label: 'Tour de cou' },
  { key: 'entrejambe', label: 'Entrejambe' },
  { key: 'longueurJambe', label: 'Longueur de jambe' },
  { key: 'longueurBoubou', label: 'Longueur de boubou' },
  { key: 'longueurChemise', label: 'Longueur de chemise' },
  { key: 'tourCuisse', label: 'Tour de cuisse' },
  { key: 'tourPoignet', label: 'Tour de poignet' },
  { key: 'carrureDos', label: 'Carrure dos' },
  { key: 'longueurManche', label: 'Longueur de manche' },
] as const;
export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]['key'];
```

- [ ] **Step 5: Vérifier que le test passe**

Run: `npm test -w packages/shared`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json packages/
git commit -m "feat: monorepo npm workspaces + package @moodly/shared (constantes métier)"
```

---

### Task 2: Squelette API Express + erreurs normalisées

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/lib/errors.ts`
- Test: `apps/api/tests/health.test.ts`

**Interfaces:**
- Consumes: `@moodly/shared` (dépendance déclarée, pas encore utilisée).
- Produces: `createApp(): express.Express` (usine sans effet de bord, utilisée par tous les tests) ; `ApiError(status: number, code: string, message: string)` ; middleware `errorHandler` déjà branché dans `createApp`.

- [ ] **Step 1: Créer le package API**

`apps/api/package.json` :

```json
{
  "name": "@moodly/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`apps/api/tsconfig.json` :

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "tests"]
}
```

Installer les dépendances :

```bash
cd /Users/macbook_1/devperso/Moodly
npm install express cors zod dotenv @moodly/shared -w apps/api
npm install -D typescript tsx vitest supertest @types/express @types/cors @types/supertest @types/node -w apps/api
```

- [ ] **Step 2: Écrire le test qui échoue**

`apps/api/tests/health.test.ts` :

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('squelette API', () => {
  it('GET /health répond ok', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('renvoie une erreur normalisée sur une route inconnue', async () => {
    const res = await request(createApp()).get('/nexiste-pas');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'INTROUVABLE', message: 'Ressource introuvable.' },
    });
  });
});
```

- [ ] **Step 3: Vérifier que le test échoue**

Run: `npm test -w apps/api`
Expected: FAIL — `Cannot find module '../src/app.js'`.

- [ ] **Step 4: Implémenter le squelette**

`apps/api/src/lib/errors.ts` :

```ts
import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: 'ERREUR_INTERNE', message: 'Une erreur est survenue. Réessaie.' },
  });
}
```

`apps/api/src/app.ts` :

```ts
import cors from 'cors';
import express from 'express';
import { errorHandler } from './lib/errors.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'INTROUVABLE', message: 'Ressource introuvable.' },
    });
  });

  app.use(errorHandler);
  return app;
}
```

`apps/api/src/server.ts` :

```ts
import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => {
  console.log(`API Moodly démarrée sur http://localhost:${port}`);
});
```

- [ ] **Step 5: Vérifier que le test passe**

Run: `npm test -w apps/api`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api package-lock.json
git commit -m "feat: squelette API Express (health, erreurs normalisées)"
```

---

### Task 3: PostgreSQL (Docker) + Prisma + modèles User/TailorProfile

**Files:**
- Create: `docker-compose.yml`
- Create: `docker/initdb/01-test-db.sql`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/.env` (non commité), `apps/api/.env.example`, `apps/api/.env.test`
- Create: `apps/api/src/lib/prisma.ts`
- Create: `apps/api/vitest.config.ts`, `apps/api/tests/env.ts`, `apps/api/tests/setup.ts`
- Modify: `apps/api/package.json` (script `pretest`)
- Test: `apps/api/tests/db.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `prisma` (singleton `PrismaClient` depuis `src/lib/prisma.ts`) ; modèles Prisma `User` (`id`, `phone` unique, `passwordHash`, `name`, `role: Role`, `avatarUrl?`, `email?`, `createdAt`, relation `tailorProfile`) et `TailorProfile` (`userId` unique, `bio?`, `location?`, `specialties: String[]`, `yearsExperience?`, `priceMin?`, `priceMax?`, `verified`) ; enum Prisma `Role { TAILLEUR CLIENT }`. Les tests suivants héritent du nettoyage : `TRUNCATE users CASCADE` avant chaque test.

- [ ] **Step 1: Lancer PostgreSQL en Docker**

`docker-compose.yml` (racine) :

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: moodly
      POSTGRES_PASSWORD: moodly
      POSTGRES_DB: moodly
    ports:
      - "5433:5432"
    volumes:
      - ./docker/initdb:/docker-entrypoint-initdb.d
      - moodly_pgdata:/var/lib/postgresql/data

volumes:
  moodly_pgdata:
```

`docker/initdb/01-test-db.sql` :

```sql
CREATE DATABASE moodly_test OWNER moodly;
```

Run: `docker compose up -d && docker compose ps`
Expected: service `db` en état `running`. (Si le port 5433 est pris, choisir 5434 et reporter le changement dans les 3 fichiers `.env*`.)

- [ ] **Step 2: Installer Prisma et écrire le schéma**

```bash
npm install @prisma/client -w apps/api
npm install -D prisma dotenv-cli -w apps/api
```

`apps/api/prisma/schema.prisma` :

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  TAILLEUR
  CLIENT
}

model User {
  id            String         @id @default(cuid())
  phone         String         @unique
  passwordHash  String
  name          String
  role          Role
  avatarUrl     String?
  email         String?
  createdAt     DateTime       @default(now())
  tailorProfile TailorProfile?

  @@map("users")
}

model TailorProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio             String?
  location        String?
  specialties     String[] @default([])
  yearsExperience Int?
  priceMin        Int?
  priceMax        Int?
  verified        Boolean  @default(false)

  @@map("tailor_profiles")
}
```

`apps/api/.env` et `apps/api/.env.example` (contenu identique) :

```
DATABASE_URL="postgresql://moodly:moodly@localhost:5433/moodly"
JWT_SECRET="dev-secret-a-changer"
JWT_REFRESH_SECRET="dev-refresh-secret-a-changer"
```

`apps/api/.env.test` :

```
DATABASE_URL="postgresql://moodly:moodly@localhost:5433/moodly_test"
JWT_SECRET="test-secret"
JWT_REFRESH_SECRET="test-refresh-secret"
```

- [ ] **Step 3: Créer la migration initiale**

Run: `cd apps/api && npx prisma migrate dev --name init && cd ../..`
Expected: `Your database is now in sync with your schema.` + dossier `apps/api/prisma/migrations/` créé.

- [ ] **Step 4: Écrire le test qui échoue**

`apps/api/src/lib/prisma.ts` :

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

`apps/api/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/env.ts', 'tests/setup.ts'],
    fileParallelism: false,
  },
});
```

`apps/api/tests/env.ts` :

```ts
import { config } from 'dotenv';

config({ path: '.env.test', override: true });
```

`apps/api/tests/setup.ts` :

```ts
import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

Dans `apps/api/package.json`, ajouter aux scripts :

```json
"pretest": "dotenv -e .env.test -- prisma migrate deploy"
```

`apps/api/tests/db.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

describe('base de données', () => {
  it('crée et relit un utilisateur', async () => {
    await prisma.user.create({
      data: {
        phone: '+221770000001',
        passwordHash: 'x',
        name: 'Test',
        role: 'CLIENT',
      },
    });
    const found = await prisma.user.findUnique({ where: { phone: '+221770000001' } });
    expect(found?.name).toBe('Test');
    expect(found?.role).toBe('CLIENT');
  });
});
```

Run: `npm test -w apps/api`
Expected: le test `db.test.ts` PASSE déjà si la migration s'est bien appliquée — c'est un test d'infrastructure, pas de TDD strict ici. S'il échoue avec une erreur de connexion, vérifier `docker compose ps` et le port.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker/ apps/api
git commit -m "feat: PostgreSQL Docker + Prisma (User, TailorProfile) + infra de tests"
```

---

### Task 4: POST /auth/register

**Files:**
- Create: `apps/api/src/lib/jwt.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Modify: `apps/api/src/app.ts` (monter `authRouter` avant le 404)
- Test: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError`, `ROLES` de `@moodly/shared`.
- Produces:
  - `signAccessToken(p: TokenPayload): string`, `signRefreshToken(p): string`, `verifyAccessToken(t: string): TokenPayload`, `verifyRefreshToken(t): TokenPayload` avec `type TokenPayload = { sub: string; role: 'TAILLEUR' | 'CLIENT' }`.
  - `authService.register(input: { phone; password; name; role }): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }>` où `PublicUser = { id, phone, name, role, avatarUrl }`.
  - Route `POST /auth/register` → 201 `{ user, accessToken, refreshToken }`.

- [ ] **Step 1: Installer les dépendances d'auth**

```bash
npm install bcryptjs jsonwebtoken -w apps/api
npm install -D @types/jsonwebtoken -w apps/api
```

- [ ] **Step 2: Écrire les tests qui échouent**

`apps/api/tests/auth.test.ts` :

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

const fatou = {
  phone: '+221771234567',
  password: 'secret123',
  name: 'Fatou',
  role: 'CLIENT',
};

describe('POST /auth/register', () => {
  it('inscrit un client et renvoie les tokens', async () => {
    const res = await request(app).post('/auth/register').send(fatou);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      phone: '+221771234567',
      name: 'Fatou',
      role: 'CLIENT',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("crée automatiquement le profil tailleur à l'inscription d'un tailleur", async () => {
    const res = await request(app).post('/auth/register').send({
      phone: '+221770000002',
      password: 'secret123',
      name: 'Mamadou',
      role: 'TAILLEUR',
    });
    expect(res.status).toBe(201);
    const profile = await prisma.tailorProfile.findUnique({
      where: { userId: res.body.user.id },
    });
    expect(profile).not.toBeNull();
    expect(profile?.verified).toBe(false);
  });

  it('refuse un téléphone déjà inscrit (409)', async () => {
    await request(app).post('/auth/register').send(fatou);
    const res = await request(app).post('/auth/register').send(fatou);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TELEPHONE_DEJA_UTILISE');
  });

  it('refuse un mot de passe trop court (400)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...fatou, password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });

  it('refuse un téléphone mal formé (400)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...fatou, phone: 'pas-un-numero' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });
});
```

- [ ] **Step 3: Vérifier que les tests échouent**

Run: `npm test -w apps/api`
Expected: FAIL — les 5 tests de `auth.test.ts` échouent en 404 (route inexistante). `health` et `db` restent verts.

- [ ] **Step 4: Implémenter jwt, service et route**

`apps/api/src/lib/jwt.ts` :

```ts
import jwt from 'jsonwebtoken';

export type TokenPayload = { sub: string; role: 'TAILLEUR' | 'CLIENT' };

function secret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret('JWT_SECRET'), { expiresIn: '15m' });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret('JWT_REFRESH_SECRET'), { expiresIn: '30d' });
}

export function verifyAccessToken(token: string): TokenPayload {
  const { sub, role } = jwt.verify(token, secret('JWT_SECRET')) as TokenPayload;
  return { sub, role };
}

export function verifyRefreshToken(token: string): TokenPayload {
  const { sub, role } = jwt.verify(token, secret('JWT_REFRESH_SECRET')) as TokenPayload;
  return { sub, role };
}
```

`apps/api/src/modules/auth/auth.service.ts` :

```ts
import bcrypt from 'bcryptjs';
import type { Role } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import { signAccessToken, signRefreshToken } from '../../lib/jwt.js';
import { prisma } from '../../lib/prisma.js';

type DbUser = {
  id: string;
  phone: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
};

function toPublicUser(user: DbUser) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

function tokensFor(user: { id: string; role: Role }) {
  const payload = { sub: user.id, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function register(input: {
  phone: string;
  password: string;
  name: string;
  role: Role;
}) {
  const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (existing) {
    throw new ApiError(409, 'TELEPHONE_DEJA_UTILISE', 'Ce numéro est déjà inscrit.');
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      phone: input.phone,
      passwordHash,
      name: input.name,
      role: input.role,
      ...(input.role === 'TAILLEUR' ? { tailorProfile: { create: {} } } : {}),
    },
  });
  return { user: toPublicUser(user), ...tokensFor(user) };
}
```

`apps/api/src/modules/auth/auth.routes.ts` :

```ts
import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{7,15}$/, 'Numéro de téléphone invalide.');

const registerSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères.'),
  name: z.string().min(1, 'Le nom est requis.').max(80),
  role: z.enum(ROLES),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  res.status(201).json(await authService.register(parsed.data));
});
```

Dans `apps/api/src/app.ts`, ajouter l'import et monter le routeur **avant** le middleware 404 :

```ts
import { authRouter } from './modules/auth/auth.routes.js';
// ... dans createApp(), après app.get('/health', ...) :
app.use('/auth', authRouter);
```

- [ ] **Step 5: Vérifier que les tests passent**

Run: `npm test -w apps/api`
Expected: PASS (8 tests au total).

- [ ] **Step 6: Commit**

```bash
git add apps/api package-lock.json
git commit -m "feat: inscription par téléphone (POST /auth/register) avec JWT"
```

---

### Task 5: POST /auth/login + POST /auth/refresh

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts` (ajouter `login`)
- Modify: `apps/api/src/modules/auth/auth.routes.ts` (routes `/login`, `/refresh`)
- Test: `apps/api/tests/auth.test.ts` (nouveaux `describe`)

**Interfaces:**
- Consumes: `register` (pour créer les comptes de test), `verifyRefreshToken`, `signAccessToken`.
- Produces: `authService.login(input: { phone: string; password: string })` → même forme de retour que `register` ; `POST /auth/login` → 200 ; `POST /auth/refresh` `{ refreshToken }` → 200 `{ accessToken }`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `apps/api/tests/auth.test.ts` :

```ts
describe('POST /auth/login', () => {
  it('connecte un utilisateur inscrit', async () => {
    await request(app).post('/auth/register').send(fatou);
    const res = await request(app)
      .post('/auth/login')
      .send({ phone: fatou.phone, password: fatou.password });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Fatou');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('refuse un mauvais mot de passe (401)', async () => {
    await request(app).post('/auth/register').send(fatou);
    const res = await request(app)
      .post('/auth/login')
      .send({ phone: fatou.phone, password: 'mauvais-mdp' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('IDENTIFIANTS_INVALIDES');
  });

  it('refuse un numéro inconnu (401)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ phone: '+221779999999', password: 'nimporte' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('IDENTIFIANTS_INVALIDES');
  });
});

describe('POST /auth/refresh', () => {
  it('délivre un nouvel access token', async () => {
    const reg = await request(app).post('/auth/register').send(fatou);
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('refuse un refresh token invalide (401)', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'token-bidon' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDE');
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npm test -w apps/api`
Expected: FAIL — les 5 nouveaux tests échouent en 404.

- [ ] **Step 3: Implémenter login et refresh**

Ajouter à `apps/api/src/modules/auth/auth.service.ts` :

```ts
export async function login(input: { phone: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new ApiError(
      401,
      'IDENTIFIANTS_INVALIDES',
      'Téléphone ou mot de passe incorrect.',
    );
  }
  return { user: toPublicUser(user), ...tokensFor(user) };
}
```

Ajouter à `apps/api/src/modules/auth/auth.routes.ts` (avec les imports `signAccessToken`, `verifyRefreshToken` depuis `../../lib/jwt.js`) :

```ts
const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Le mot de passe est requis.'),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  res.json(await authService.login(parsed.data));
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken manquant.'),
});

authRouter.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  let payload;
  try {
    payload = verifyRefreshToken(parsed.data.refreshToken);
  } catch {
    throw new ApiError(401, 'TOKEN_INVALIDE', 'Session expirée, reconnecte-toi.');
  }
  res.json({ accessToken: signAccessToken(payload) });
});
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npm test -w apps/api`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: connexion (POST /auth/login) et refresh token (POST /auth/refresh)"
```

---

### Task 6: Middleware requireAuth/requireRole + GET /me

**Files:**
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/modules/users/users.routes.ts`
- Modify: `apps/api/src/app.ts` (monter `usersRouter`)
- Test: `apps/api/tests/me.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken`, `TokenPayload`, `ApiError`, `prisma`.
- Produces: `requireAuth` (middleware — pose `req.user: TokenPayload`) ; `requireRole(role: 'TAILLEUR' | 'CLIENT')` (fabrique de middleware, à utiliser **après** `requireAuth`) ; `GET /me` → 200 `{ user }` avec `tailorProfile` inclus si tailleur. Les jalons 2 et 3 réutilisent ces deux middlewares sur toutes les routes protégées.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/api/tests/me.test.ts` :

```ts
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/lib/errors.js';
import { requireAuth, requireRole } from '../src/middleware/auth.js';

const app = createApp();

async function registerAndGetToken(role: 'TAILLEUR' | 'CLIENT', phone: string) {
  const res = await request(app).post('/auth/register').send({
    phone,
    password: 'secret123',
    name: role === 'TAILLEUR' ? 'Mamadou' : 'Fatou',
    role,
  });
  return res.body.accessToken as string;
}

describe('GET /me', () => {
  it('refuse sans token (401)', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NON_AUTHENTIFIE');
  });

  it('refuse un token invalide (401)', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer bidon');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDE');
  });

  it('renvoie le profil du tailleur connecté avec son tailorProfile', async () => {
    const token = await registerAndGetToken('TAILLEUR', '+221770000010');
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Mamadou');
    expect(res.body.user.tailorProfile).not.toBeNull();
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});

describe('requireRole', () => {
  function miniApp() {
    const mini = express();
    mini.get('/tailleurs-seulement', requireAuth, requireRole('TAILLEUR'), (_req, res) => {
      res.json({ ok: true });
    });
    mini.use(errorHandler);
    return mini;
  }

  it('bloque un client sur une route tailleur (403)', async () => {
    const token = await registerAndGetToken('CLIENT', '+221770000011');
    const res = await request(miniApp())
      .get('/tailleurs-seulement')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCES_REFUSE');
  });

  it('laisse passer un tailleur', async () => {
    const token = await registerAndGetToken('TAILLEUR', '+221770000012');
    const res = await request(miniApp())
      .get('/tailleurs-seulement')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npm test -w apps/api`
Expected: FAIL — `Cannot find module '../src/middleware/auth.js'`.

- [ ] **Step 3: Implémenter middleware et route /me**

`apps/api/src/middleware/auth.ts` :

```ts
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { verifyAccessToken, type TokenPayload } from '../lib/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'NON_AUTHENTIFIE', 'Connexion requise.');
  }
  try {
    req.user = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    throw new ApiError(401, 'TOKEN_INVALIDE', 'Session expirée, reconnecte-toi.');
  }
  next();
}

export function requireRole(role: 'TAILLEUR' | 'CLIENT') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      throw new ApiError(403, 'ACCES_REFUSE', 'Tu n’as pas accès à cette action.');
    }
    next();
  };
}
```

`apps/api/src/modules/users/users.routes.ts` :

```ts
import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      avatarUrl: true,
      email: true,
      createdAt: true,
      tailorProfile: true,
    },
  });
  if (!user) {
    throw new ApiError(401, 'NON_AUTHENTIFIE', 'Compte introuvable.');
  }
  res.json({ user });
});
```

Dans `apps/api/src/app.ts`, après `app.use('/auth', authRouter);` :

```ts
import { usersRouter } from './modules/users/users.routes.js';
// ...
app.use(usersRouter);
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npm test -w apps/api`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: middleware requireAuth/requireRole + GET /me"
```

---

### Task 7: Finition du jalon — typecheck, README, vérification manuelle

**Files:**
- Create: `README.md` (racine)
- Modify: `.gitignore` (si besoin)

**Interfaces:**
- Consumes: tout le jalon.
- Produces: documentation de démarrage pour les jalons suivants.

- [ ] **Step 1: Typecheck et suite complète**

Run: `npm run typecheck -w apps/api && npm test`
Expected: 0 erreur TypeScript ; 20 tests verts (2 shared + 18 api).

- [ ] **Step 2: Vérification manuelle de bout en bout**

```bash
npm run dev:api &
sleep 2
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+221771112233","password":"secret123","name":"Awa","role":"TAILLEUR"}'
```

Expected: `{"status":"ok"}` puis un JSON avec `user`, `accessToken`, `refreshToken`. Arrêter le serveur ensuite (`kill %1`).

- [ ] **Step 3: Écrire le README**

`README.md` :

````markdown
# Moodly

La plateforme digitale des tailleurs sénégalais — réseau social de mode
africaine + fiche client digitale + commandes.

## Démarrage

Prérequis : Node ≥ 20, Docker.

```bash
docker compose up -d        # PostgreSQL (port 5433)
npm install
cd apps/api && npx prisma migrate dev && cd ../..
npm run dev:api             # API sur http://localhost:3000
```

## Tests

```bash
npm test
```

## Structure

- `apps/api` — API Express + Prisma/PostgreSQL
- `apps/mobile` — app Expo (jalon 4)
- `packages/shared` — constantes et types métier partagés
- `docs/superpowers/specs` — design validé
- `docs/superpowers/plans` — plans d'implémentation par jalon
````

- [ ] **Step 4: Commit final du jalon**

```bash
git add README.md .gitignore
git commit -m "chore: README de démarrage — jalon 1 terminé"
```
