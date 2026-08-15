# MVP1 · M5 — Signalement / blocage — Design

_Design validé le 2026-08-14. Réf. produit : `docs/product/2026-07-16-cdc-social-commerce.md` (backlog « finir MVP1 », M5)._

## Contexte

Le CDC prévoit un jalon **modération** (M5). Aujourd'hui il n'existe **aucun**
mécanisme de signalement ni de blocage. Le spec M3 (commentaires) avait
explicitement renvoyé le signalement de commentaire « → M5 ».

M5 apporte deux fonctions liées :
- **Signalement** : un utilisateur signale un contenu (modèle, commentaire) ou un
  autre utilisateur pour examen ultérieur.
- **Blocage** : un utilisateur en bloque un autre ; leurs contenus se masquent
  mutuellement et l'interaction (suivre) est coupée.

## Décisions / portée

- **Cibles signalables** : modèle (`DESIGN`), commentaire (`COMMENT`), utilisateur (`USER`).
- **Blocage complet** : masque les modèles du bloqué dans le feed, masque ses
  commentaires, empêche de suivre (dans les deux sens).
- **Pas de back-office admin dans M5** (aucun rôle/écran admin n'existe). Les
  signalements sont **stockés** sans action automatique.
- **Contrainte forte (demandée)** : le modèle de données de modération doit être
  **prêt pour un admin ultérieur** — statut, horodatage de résolution, modérateur,
  note — de sorte que le back-office se branche **sans migration**. Voir §Admin-readiness.

## Base de données (`apps/api/prisma/schema.prisma`)

Enums :
```prisma
enum ReportTargetType { DESIGN COMMENT USER }
enum ReportReason { INAPPROPRIE SPAM PLAGIAT HARCELEMENT AUTRE }
enum ReportStatus { OPEN REVIEWING RESOLVED REJECTED }
```

Modèle `Report` :
```prisma
model Report {
  id             String           @id @default(cuid())
  reporterId     String
  reporter       User             @relation("reportsMade", fields: [reporterId], references: [id], onDelete: Cascade)
  targetType     ReportTargetType
  targetId       String
  reason         ReportReason
  details        String?          // texte libre optionnel
  status         ReportStatus     @default(OPEN)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  // Champs « admin-ready » (renseignés plus tard par le back-office modération) :
  resolvedById   String?
  resolvedBy     User?            @relation("reportsResolved", fields: [resolvedById], references: [id], onDelete: SetNull)
  resolvedAt     DateTime?
  resolutionNote String?

  @@unique([reporterId, targetType, targetId])   // anti-doublon
  @@index([status])                              // futur admin : lister les OPEN
  @@index([targetType, targetId])                // regrouper par cible
  @@map("reports")
}
```

Modèle `Block` :
```prisma
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

Relations inverses sur `User` : `reportsMade Report[] @relation("reportsMade")`,
`reportsResolved Report[] @relation("reportsResolved")`,
`blocksMade Block[] @relation("blocksMade")`, `blockedBy Block[] @relation("blockedBy")`.

Une migration Prisma `add_reports_and_blocks`.

### Admin-readiness (hors périmètre M5, préparé ici)

Le back-office futur pourra, **sans migration** : lister `Report` par `status`
(index en place), passer `OPEN → REVIEWING → RESOLVED|REJECTED`, renseigner
`resolvedById` / `resolvedAt` / `resolutionNote`. Restera à ajouter à ce moment-là :
un rôle `ADMIN` (ou table de modérateurs) et les routes `GET /admin/reports` +
`PATCH /admin/reports/:id`. **Rien de tout cela n'est construit dans M5.**

## Backend

### Signalement — `POST /reports` (nouveau module `modules/reports/`)

- `requireAuth`. Corps `{ targetType, targetId, reason, details? }` validé par zod
  (enums, `details` ≤ 500).
- **Existence de la cible** selon `targetType` : `design` / `comment` / `user`
  (`role` quelconque) ; sinon 404 `INTROUVABLE`.
- **Pas d'auto-signalement** d'un `USER` sur soi-même → 400.
- Création idempotente : si `(reporterId, targetType, targetId)` existe déjà →
  répondre **200** `{ report, alreadyReported: true }` ; sinon **201** `{ report }`.
- Aucune action automatique (stockage seul).

### Blocage — `modules/blocks/` (monté sous `/users`)

- `POST /users/:id/block` (`requireAuth`) : cible existe (404 sinon) ; pas soi-même
  (400) ; crée le `Block` (idempotent via `upsert`/catch unique). **Effet de bord** :
  supprime tout `Follow` existant entre les deux (dans les deux sens).
- `DELETE /users/:id/block` : supprime le `Block` (idempotent).
- `GET /me/blocks` : `{ blockedIds: string[] }` (les utilisateurs que le viewer a bloqués),
  pour l'état bouton côté mobile.

### Helper de filtrage — `getBlockedUserIds(viewerId): Promise<string[]>`

- Renvoie l'ensemble des ids en relation de blocage avec le viewer **dans les deux
  sens** (`blockerId = viewer` OU `blockedId = viewer`). Placé dans
  `modules/blocks/blocks.service.ts`, réutilisé par le feed et les commentaires.
- Pour un viewer non connecté (`viewerId` vide) → `[]`.

### Application du blocage aux lectures existantes

- **Feed** `GET /designs` (`designs.routes.ts` + `getForYouFeed`) : ajouter
  `tailorId: { notIn: blockedIds }` aux `where` (mode curseur, foryou 2 phases,
  following). Aucun effet si `blockedIds` vide.
- **Commentaires** `getThreadedComments(designId, viewerId)` : exclure les commentaires
  dont `userId ∈ blockedIds` (filtrer la requête ou post-filtrer l'arbre en retirant
  aussi leurs réponses orphelines).
- **Suivi** `POST /tailors/:id/follow` : si un blocage existe dans un sens ou l'autre
  → 403 `ACTION_IMPOSSIBLE`.

## Mobile

### Types & hooks (`src/moderation/`)

- `useReport()` : `POST /reports` → `report({ targetType, targetId, reason, details? })`.
- `useBlock()` / `useUnblock()` : `POST`/`DELETE /users/:id/block`, invalident
  `['tailor', id]`, `['feed']`, `['blocks']`.
- `useBlockedIds()` : `GET /me/blocks` (pour l'état bouton).
- `REPORT_REASONS` : libellés FR des raisons.

### Composants

- **`ReportSheet`** : feuille de choix de la raison (5 options) + validation + envoi ;
  confirmation « Merci, signalement envoyé ». Réutilisable pour les 3 cibles.
- **Menu « ⋯ »** sur le **détail d'un modèle** (`design/[id]`) : « Signaler le modèle »,
  « Signaler le tailleur », « Bloquer le tailleur ».
- **Commentaire** (`CommentItem`) : action « Signaler » (via menu/appui long).
- **Profil tailleur** (`tailor/[id]`) : « Bloquer » / « Débloquer » (état via
  `useBlockedIds`), et « Signaler ».

Thème sombre, cohérent avec l'app. Le contenu bloqué disparaît du feed/commentaires
après invalidation des caches.

## Gestion d'erreurs

- Cible inexistante → 404 `INTROUVABLE`. Auto-signalement/auto-blocage USER → 400.
- Suivre malgré un blocage → 403 `ACTION_IMPOSSIBLE`.
- Doublon de signalement → 200 idempotent (pas d'erreur). Doublon de blocage → idempotent.
- Mobile : messages FR + réessai réseau.

## Tests

**API** :
- `POST /reports` : crée (201) pour DESIGN/COMMENT/USER ; 404 cible inconnue ;
  400 auto-signalement USER ; 200 idempotent au 2ᵉ signalement identique ; enum invalide → 400.
- Blocage : `POST /users/:id/block` crée et supprime les follows croisés ; 400 soi-même ;
  404 inconnu ; `DELETE` débloque ; `GET /me/blocks` renvoie les ids.
- Effets : feed exclut les modèles d'un bloqué (les deux sens) ; `getThreadedComments`
  masque les commentaires d'un bloqué ; follow bloqué → 403.

**Mobile** :
- `ReportSheet` : sélection d'une raison + envoi appelle `useReport`.
- Hooks `useBlock`/`useBlockedIds` : appellent les bons endpoints (mock apiFetch).
- Profil : bouton bascule Bloquer/Débloquer selon `useBlockedIds`.

## Vérification

- `apps/api` : `npm run typecheck` + `npm test` verts (migration test appliquée).
- `apps/mobile` : `npx tsc --noEmit` + `npx jest` verts.
