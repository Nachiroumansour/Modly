# MVP1 · M3 — Commentaires hiérarchisés — Design

_Design validé le 2026-08-12. Réf. produit : `docs/product/2026-07-16-cdc-social-commerce.md`._

## Contexte

Les commentaires sont **plats** (`Comment { id, userId, designId, text, createdAt }`).
Le CDC veut une hiérarchie sociale : **réponses, like de commentaire, épingle par le
tailleur, suppression par l'auteur**. Le popup `CommentsSheet` (M/bloc D) affiche
aujourd'hui une liste plate.

## Décisions / portée

- **Réponses à un niveau** (façon Instagram) : une réponse a un `parentId` = un
  commentaire **racine** du même modèle ; répondre à une réponse est rattaché au
  commentaire racine.
- **Like de commentaire** idempotent (table `CommentLike`).
- **Épingle** : le **tailleur propriétaire du modèle** peut épingler ; **une seule
  épingle par modèle** (épingler dés-épingle les autres). Épinglé affiché en tête.
- **Suppression par l'auteur** uniquement (supprimer un commentaire racine supprime
  ses réponses en cascade). `commentsCount` décrémenté en conséquence.
- **Signalement** de commentaire = **hors périmètre → M5** (modération).
- Hors périmètre : réponses multi-niveaux, mentions cliquables, édition.

## Modèle de données (Prisma)

- `Comment` : ajouter
  - `parentId String?` + `parent Comment? @relation("replies", fields: [parentId],
    references: [id], onDelete: Cascade)` + `replies Comment[] @relation("replies")`,
  - `likesCount Int @default(0)`, `pinned Boolean @default(false)`,
  - `likes CommentLike[]`.
- Nouvelle `CommentLike` : `{ id, userId, commentId, createdAt, @@unique([userId,
  commentId]), @@index([commentId]) }` + relations `user`, `comment`
  (onDelete Cascade). Inverse `commentLikes CommentLike[]` sur `User`.
- Migration additive.

## Forme API d'un commentaire (`ApiComment`)

```
{ id, text, createdAt, user: { id, name, avatarUrl },
  likesCount, likedByMe, pinned, parentId,
  replies: ApiComment[] }   // les réponses ont replies = []
```

## API

- **`POST /designs/:id/comments { text, parentId? }`** (auth) : commentaire ou réponse.
  Si `parentId` : valider qu'il pointe un commentaire **racine** du **même** modèle
  (sinon 400). Incrémente `design.commentsCount`. Renvoie l'`ApiComment` créé.
- **`GET /designs/:id/comments`** (auth optionnelle) : **arborescent** — racines
  (`parentId = null`) triées **épinglé d'abord puis `createdAt asc`**, chacune avec ses
  `replies` (triées `createdAt asc`), `likesCount`, `likedByMe` (selon le viewer),
  `pinned`. Service `getThreadedComments(designId, viewerId)`.
- **`POST /comments/:id/like` / `DELETE /comments/:id/like`** (auth) : like/unlike
  idempotent (mirroir des réactions modèle : `CommentLike` unique + `likesCount`).
- **`DELETE /comments/:id`** (auth) : **auteur uniquement** (sinon 404). Décrémente
  `design.commentsCount` de `1 + (nb de réponses)` si racine, sinon `1`.
- **`PATCH /comments/:id/pin { pinned: boolean }`** (auth) : **propriétaire du modèle**
  (le `design.tailorId` du commentaire == viewer, sinon 404). Si `pinned=true` :
  met `pinned=false` sur les autres commentaires du modèle (épingle unique) puis
  `pinned=true` sur le ciblé. Réservé aux **racines** (on n'épingle pas une réponse).
- Nouveau module `apps/api/src/modules/comments/` (routes montées `/comments`) pour
  like/delete/pin ; le POST/GET commentaires restent sur `designs.routes` mais
  délèguent au service enrichi.
- La réponse détail `GET /designs/:id` peut continuer de renvoyer des commentaires,
  mais le `CommentsSheet` charge via son propre hook (`useComments`) — les
  commentaires inline du détail deviennent inutilisés (nettoyage optionnel).

## Mobile

### `useComments(designId)` (`apps/mobile/src/design/useComments.ts`)

react-query : `list` (threadée, `['comments', designId]`) + mutations
`post(text, parentId?)`, `toggleLike(commentId, liked)`, `remove(commentId)`,
`togglePin(commentId, pinned)`. Invalident `['comments', designId]` et
`['design', designId]` (compteur). Type `ApiComment` ajouté à `types.ts`.

### `CommentItem` (`apps/mobile/src/design/CommentItem.tsx`) — présentiel testable

- Props : `{ comment, viewerId, designTailorId, onLike, onReply, onDelete, onPin }`.
- Rend : avatar initiale + nom, texte, **badge « Épinglé »** si `pinned`, **cœur +
  compteur** (accent si `likedByMe`), **« Répondre »** ; si `comment.user.id ===
  viewerId` → action **Supprimer** ; si `viewerId === designTailorId` → **Épingler/
  Désépingler**. Rend ses **réponses en retrait** (chaque réponse = un `CommentItem`
  sans ses propres réponses, sans « Répondre » imbriqué au-delà d'un niveau).
- testIDs : `comment-like-<id>`, `comment-reply-<id>`, `comment-delete-<id>`,
  `comment-pin-<id>`.

### `CommentsSheet` (conteneur) — remaniement

- Devient un conteneur : `props { visible, onClose, designId, viewerId, designTailorId,
  authed, onRequireAuth }`. Utilise `useComments(designId)`. Rend la liste de
  `CommentItem` (patron bottom sheet inchangé : backdrop, poignée, titre). Barre de
  saisie en bas : si **réponse en cours**, affiche « Réponse à @nom » + annuler ;
  `post(text, replyTarget?)`. Invité : gate.
- `DesignScreen` passe `designId`, `viewerId` (user id), `designTailorId`
  (`design.tailor.id`) au sheet ; ne passe plus la liste `comments`/`commentText`
  (gérés par `useComments`). `useDesignActions` allégé (commentaire retiré) ou laissé
  (le sheet ne l'utilise plus).

## Tests

- **Backend** (Vitest+Supertest, conventions repo) :
  - réponse rattachée au bon parent (parentId d'un modèle différent → 400) ;
  - GET arborescent : épinglé en tête, réponses sous leur racine ;
  - like idempotent (2× POST = `likesCount` 1) + `likedByMe` ;
  - delete auteur-only (autre user → 404) + `commentsCount` recalé (réponses incluses) ;
  - pin propriétaire-only (autre → 404) + épingle unique.
- **Mobile** : `CommentItem` (like/réponses affichées ; actions delete/pin visibles
  selon `viewerId`/`designTailorId` ; handlers déclenchés). `CommentsSheet` : liste +
  saisie (hook mocké) — au moins un test de rendu threadé.

## Contraintes globales

- Prisma 6 ; migrations/bundle **Node 20** ; tests API via `npm test`. Piège babel :
  ASCII dans les `.ts`. Tokens de thème ; jamais de `fontWeight`. `imageUri` (avatars
  = initiales ici). Ne pas casser les suites (API 113 / mobile 73). Réutiliser le
  patron `CommentsSheet` (bottom sheet) + le style commentaire existant.
