# MVP1 · M4 — Notifications (in-app + push) — Design

Date : 2026-08-12
Statut : validé (brainstorming) → prêt pour plan d'implémentation
Branche cible : `mvp1-m4-notifications` (depuis `main`)

## Objectif

Donner à Modly un système de notifications « comme les plateformes sociales » : l'utilisateur est prévenu quand on aime/commente son contenu, quand quelqu'un le suit, et à chaque étape de ses commandes. Deux canaux :

1. **In-app** (livré et testable immédiatement, y compris dans Expo Go) : écran Notifications réel + pastille non-lu sur la cloche de l'en-tête.
2. **Push** (code de bout en bout maintenant, actif une fois l'app buildée/publiée sur les stores) : Expo Push. Non testable dans Expo Go SDK 54 (le push distant y a été retiré depuis le SDK 53) — c'est assumé et sans risque : sans jeton enregistré, l'envoi est un no-op.

## Périmètre

Dans le périmètre :
- Table `Notification` avec **regroupement** (une ligne par groupe, pas par événement brut).
- Table `PushToken` + endpoints d'enregistrement/suppression.
- Création de notification sur **5 déclencheurs** : like, commentaire, réponse, follow, commande.
- **Ajout d'une annulation de commande côté client** (capacité nouvelle, minimale) pour que la notif « le client a annulé » puisse exister.
- Endpoints de lecture/comptage/marquage-lu.
- Écran mobile réel + pastille cloche + enregistrement du jeton push.
- Envoi push Expo côté serveur (best-effort, silencieux).

Hors périmètre (cycles futurs) :
- Regroupement à fenêtres de temps / dé-doublonnage strict des acteurs (voir « dérive assumée »).
- Préférences de notification par type (tout activé par défaut).
- Notifications d'épinglage de commentaire, de mention, de nouveau modèle d'un tailleur suivi.
- Email / SMS.

## Modèle de données (Prisma)

```prisma
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

enum NotificationType {
  LIKE
  COMMENT
  REPLY
  FOLLOW
  ORDER
}

model PushToken {
  id        String   @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("push_tokens")
}
```

Relations inverses à ajouter sur `User` : `recipientNotifications Notification[] @relation("recipientNotifications")`, `actorNotifications Notification[] @relation("actorNotifications")`, `pushTokens PushToken[]`. Sur `Design` et `Order` : `notifications Notification[]`.

Note `commentId` : pas de relation Prisma stricte (un commentaire supprimé ne casse rien ; la notif reste, la navigation ouvre juste le modèle). On garde `commentId` en simple `String?` pour éviter un `onDelete` en cascade qui effacerait l'historique de notif au moindre commentaire supprimé.

## Regroupement (cœur du design)

Toute création passe par un helper unique `createNotification()` qui fait **un `upsert`** sur la contrainte `@@unique([recipientId, type, groupKey])`.

| Type | `groupKey` | Regroupé ? | Rendu |
|------|-----------|-----------|-------|
| LIKE | `design:<designId>` | oui (tous les likes d'un modèle) | « Awa et 3 autres ont aimé votre modèle » |
| FOLLOW | `follow` | oui (tous les nouveaux abonnés) | « Oumar et 5 autres vous suivent » |
| COMMENT | `comment:<commentId>` | non (clé unique) | « Awa a commenté votre modèle » |
| REPLY | `reply:<commentId>` | non (clé unique) | « Awa a répondu à votre commentaire » |
| ORDER | `order:<orderId>:<status>` | non | « Votre commande est passée en Couture » / « Nouvelle commande reçue » / « Le client a annulé sa commande » |

Comportement de l'upsert :
- **create** : `actorCount = 1`, `lastActorId = acteur`, `read = false`, cibles renseignées.
- **update** (le groupe existe déjà) : `actorCount += 1`, `lastActorId = acteur` (le plus récent), `read = false` (refait remonter), `updatedAt` auto.

**Règle d'or** : si `acteur === recipientId`, on ne crée **rien** (pas d'auto-notification).

**Dérive assumée (MVP)** : `actorCount` est un compteur incrémental, pas un ensemble d'acteurs distincts. Un cycle unlike→relike ou un follow→unfollow→refollow peut sur-compter de 1. Acceptable au MVP (comportement proche d'Instagram) ; le dé-doublonnage strict est hors périmètre. Les déclencheurs ne s'exécutent que sur un événement réellement **nouveau** (voir §Déclencheurs) pour limiter la dérive.

## Déclencheurs (points de branchement dans le code existant)

Un helper `createNotification()` dans `modules/notifications/notifications.service.ts` est appelé à ces sites. Chaque appel est encapsulé pour **ne jamais faire échouer l'action métier** (try/catch : une notif ratée ne casse pas un like).

1. **LIKE** — `designs/designs.service.ts` `addReaction`, uniquement `kind === 'like'` et **uniquement quand la ligne `Like` est réellement créée** (dans le chemin succès, pas dans le catch P2002). Destinataire = `design.tailorId`.
2. **COMMENT** (racine) — `designs/designs.service.ts` `addComment`, quand `parentId` absent. Destinataire = `design.tailorId`.
3. **REPLY** — `addComment`, quand `parentId` présent. Destinataire = `parent.userId`.
4. **FOLLOW** — `tailors/tailors.routes.ts` (POST follow), **uniquement si le follow est nouvellement créé** (gérer l'idempotence P2002). Destinataire = `tailorId`.
5. **ORDER — nouvelle commande** — `orders/orders.routes.ts` POST `/`. Destinataire = **tailleur** (`tailorId`). `groupKey = order:<id>:EN_ATTENTE`.
6. **ORDER — changement de statut** (tailleur) — `orders/orders.routes.ts` PATCH `/:id/status`. Destinataire = **client** (`clientId`). `groupKey = order:<id>:<status>`.
7. **ORDER — annulation client** — voir §Annulation client. Destinataire = **tailleur**.

Dans tous les cas order, si l'acteur est aussi le destinataire (ne devrait pas arriver, client ≠ tailleur), on skip par la règle d'or.

## Annulation de commande côté client (capacité nouvelle)

Aujourd'hui `PATCH /:id/status` est réservé au tailleur ; le client ne peut pas annuler. Pour que la notif #7 existe, on ajoute une capacité minimale et sûre :

- **Route** `PATCH /orders/:id/cancel` (`requireRole('CLIENT')`).
- Le client doit être le propriétaire (`order.clientId === user.sub`), sinon 404 `INTROUVABLE`.
- Autorisé uniquement si la commande est **encore annulable** : statut `EN_ATTENTE` (avant que le tailleur ait commencé). Sinon 409 `ANNULATION_IMPOSSIBLE`. (`assertTransition` de la machine à états est réutilisé : `EN_ATTENTE → ANNULEE` est déjà valide.)
- Effet : passe `status = ANNULEE`, crée un `OrderEvent { status: ANNULEE, note }`, puis notifie le tailleur (type ORDER).
- Idempotent : si déjà `ANNULEE`, renvoyer la commande sans re-notifier.

Ce point est un **ajout de fonctionnalité assumé** (demandé explicitement pour supporter la notification d'annulation), documenté ici et à re-signaler en revue.

## Endpoints (nouveau module `modules/notifications/`)

Toutes sous `requireAuth`.

- `GET /me/notifications?cursor=<updatedAt|id>` — liste paginée curseur (tri `updatedAt desc`), enrichie de `lastActor { id, name, avatarUrl }` et d'un aperçu de la cible (`design { id, title, imageUrl, coverBlurhash }` ou `order { id, status }`). Renvoie `{ notifications, nextCursor }`.
- `GET /me/notifications/unread-count` — `{ count }` (nombre de notifs `read = false`).
- `POST /me/notifications/read-all` — marque toutes les notifs du destinataire `read = true`. `{ ok: true }`.
- `POST /me/notifications/:id/read` — marque une notif lue (propriété vérifiée, 404 sinon).
- `POST /me/push-tokens` `{ token }` — upsert (token `@unique`, rattaché au `userId` courant ; si le token existait pour un autre user, il est ré-attribué à l'utilisateur courant). `{ ok: true }`.
- `DELETE /me/push-tokens/:token` — supprime le jeton (déconnexion). `{ ok: true }`.

Le module expose aussi `createNotification()` (helper interne) et `sendPush()` (voir §Push), importés par les sites déclencheurs.

## Push Expo (câblé, actif en prod)

- `sendPush(recipientId, { title, body, data })` : lit les `PushToken` du destinataire ; s'il n'y en a pas → **no-op**. Sinon `fetch('https://exp.host/--/api/v2/push/send', { method: POST, ... })` avec le format Expo (`to`, `title`, `body`, `data`). Pas de SDK tiers.
- Appelé par `createNotification()` **après** l'upsert réussi, en best-effort (try/catch silencieux + `console.warn` en cas d'échec réseau ; ne bloque jamais la requête). Idéalement hors transaction / non-awaité de façon bloquante — on `await` mais on avale les erreurs.
- `data` contient de quoi router au tap : `{ type, designId?, orderId?, notificationId }`.
- Jetons invalides (`DeviceNotRegistered` renvoyé par Expo) : suppression best-effort du `PushToken` correspondant (nettoyage). Optionnel au MVP mais peu coûteux — inclus.
- **Contrôlé par une variable d'env** `PUSH_ENABLED` (défaut : envoi tenté ; en tests, désactivé pour ne pas appeler le réseau). En pratique le no-op « aucun token » suffit déjà en dev.

## Mobile

- `src/notifications/hooks.ts` : `useNotifications()` (react-query infinite, curseur), `useUnreadCount()` (react-query, `refetchOnWindowFocus`/refetch à l'ouverture d'écran), `useMarkAllRead()` (mutation + invalidation).
- `src/notifications/render.ts` : helper **pur et testé** `notificationText(n)` qui produit le libellé FR à partir du type, `lastActor.name` et `actorCount` (« Awa », « Awa et 1 autre », « Awa et N autres »). Séparé pour être testable sans rendu.
- `app/notifications.tsx` : remplace le placeholder. Liste sombre (cohérente TikTok) : avatar de `lastActor`, texte via `notificationText`, vignette du modèle si présent, temps relatif, point d'accent si `!read`. À l'ouverture de l'écran → `markAllRead`. Tap sur une ligne → navigation :
  - LIKE / COMMENT / REPLY → `/design/<designId>` (REPLY/COMMENT peut viser le fil de commentaires).
  - FOLLOW → profil de `lastActor` (`/tailor/<id>` ou profil public selon le rôle).
  - ORDER → `/order/<orderId>` (détail + timeline).
- `AppHeader` (`src/ui/AppHeader.tsx`) : **pastille rouge** sur l'icône cloche quand `useUnreadCount().count > 0` (point simple, ou nombre si simple à afficher).
- `src/notifications/push.ts` : `registerPushToken()` — via `expo-notifications` : demande la permission, récupère l'Expo push token, `POST /me/push-tokens`. Appelé après connexion réussie (dans `AuthContext`). `unregisterPushToken()` à la déconnexion (`DELETE`). Handler `addNotificationResponseReceivedListener` → deep-link vers l'écran cible via `data`. Tout est **tolérant à l'échec** (permission refusée, Expo Go sans push → on log et on continue, l'app marche).

Dépendance nouvelle : `expo-notifications` (compatible SDK 54).

## Gestion d'erreurs

- Une notification ratée ne fait **jamais** échouer l'action métier (like/commentaire/follow/commande) → try/catch autour de `createNotification`.
- Push best-effort, silencieux.
- Propriété vérifiée sur read/read-all/cancel (404 `INTROUVABLE` si pas destinataire/propriétaire).
- Annulation impossible → 409 `ANNULATION_IMPOSSIBLE`.

## Tests

**API (~15) :**
- Regroupement : 2 likes de 2 users sur un modèle → 1 notif, `actorCount = 2`, `lastActor` = dernier.
- Commentaire/réponse → notifs distinctes (non regroupées).
- Follow → notif ; refollow après unfollow ne crée pas de 2e ligne (même groupe).
- Pas d'auto-notification (liker/commenter son propre modèle).
- Nouvelle commande → notif tailleur ; changement de statut → notif client.
- Annulation client : EN_ATTENTE → ANNULEE ok + notif tailleur ; statut avancé → 409 ; non-propriétaire → 404 ; idempotence (déjà annulée).
- `unread-count`, `read-all`, `:id/read` (propriété).
- `sendPush` no-op sans token (mock fetch : non appelé) ; appelé avec token (fetch mocké).
- Enregistrement/suppression de push token (upsert, ré-attribution).

**Mobile (~7) :**
- `notificationText` : cas simple, « et 1 autre », « et N autres », chaque type.
- Rendu liste : ligne non-lue (point accent), regroupée, vignette modèle.
- Pastille cloche visible si `unreadCount > 0`, absente sinon.

## Décisions produit figées

- 5 déclencheurs standard + annulation client.
- Regroupement : likes et follows regroupés ; commentaires/réponses/commandes individuels.
- Commandes : tailleur notifié à la création **et à l'annulation client** ; client notifié aux changements de statut du tailleur.
- Jamais d'auto-notification.
- Push codé maintenant, actif en prod (no-op sans jeton).
