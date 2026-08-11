# MVP1 · M1 — Collections nommées — Design

_Design validé le 2026-07-16. Réf. produit : `docs/product/2026-07-16-cdc-social-commerce.md`._

## Contexte

Premier sous-bloc du chantier « finir MVP1 ». Aujourd'hui l'onglet **Sauvegardés**
affiche les modèles enregistrés **à plat** (`GET /me/bookmarks` → masonry). Le cahier
des charges veut des **collections privées** (Mariage, Boubous, À commander…) — des
« boards » façon Pinterest.

**Exigence UX (Manou) : le design doit être soigné, inspiré de Pinterest (boards,
densité visuelle, enregistrement) et de la fluidité TikTok.** C'est un critère de
réussite, pas un détail.

## Décisions / portée

- Table **`Collection`** (privée, par client) ; `Bookmark` gagne un `collectionId`
  nullable → un modèle enregistré est **rangé dans une collection** ou « non classé ».
- **Un modèle dans une seule collection à la fois** (déplaçable). Multi-collections =
  hors périmètre (plus tard).
- L'**enregistrement** (marque-page) reste un **tap rapide** → non classé. Le rangement
  se fait depuis Enregistrés via un **sheet « Ranger dans… »** (façon Pinterest board
  picker). Zéro friction à la sauvegarde.
- Supprimer une collection = ses bookmarks repassent `collectionId = null` (jamais de
  perte d'enregistrement).
- **Aucun impact** sur like/commande. Réservé au rôle **client** (le tailleur peut aussi
  enregistrer, mais l'onglet Sauvegardés est côté client dans la nav — collections
  disponibles pour tout utilisateur qui enregistre).

## Modèle de données (Prisma)

```prisma
model Collection {
  id        String     @id @default(cuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  createdAt DateTime   @default(now())
  bookmarks Bookmark[]

  @@unique([userId, name])
  @@index([userId])
  @@map("collections")
}
```

- `Bookmark` : ajouter `collectionId String?` + relation
  `collection Collection? @relation(fields: [collectionId], references: [id], onDelete: SetNull)`.
  Inverse `bookmarks Bookmark[]` sur `Collection` (ci-dessus) et `collections
  Collection[]` sur `User`.
- Migration additive (aucune donnée perdue ; bookmarks existants restent non classés).

## API (auth requise ; propriété stricte → 404 si pas à soi)

- `GET /me/collections` → `{ collections: [{ id, name, count, covers }] }` où `covers`
  = jusqu'à **4** `imageUrl` (chemins relatifs) des modèles rangés, pour la mosaïque.
  Inclut un total « tous » côté client (ou endpoint séparé — voir mobile).
- `POST /me/collections` `{ name }` → crée ; **409** si nom déjà pris (`@@unique`).
  Validation : nom 1–40 caractères, trim.
- `PATCH /me/collections/:id` `{ name }` → renomme (409 si doublon, 404 si pas à soi).
- `DELETE /me/collections/:id` → supprime (bookmarks → `collectionId=null`), 404 sinon.
- `GET /me/collections/:id` → `{ collection: { id, name }, designs: ApiDesign[] }`
  (les modèles rangés, via `designInclude/toApiDesign` → cartes complètes).
- `PATCH /me/bookmarks/:designId` `{ collectionId: string | null }` → **upsert** du
  bookmark du client sur ce design et fixe `collectionId`. Valide que la collection
  (si non null) appartient au client (sinon 404). Sert de « ranger dans… ».
- `GET /me/bookmarks` (existant) → tous les enregistrés (vue « Tous »).

## Mobile — UX Pinterest (le cœur du bloc)

### Onglet **Enregistrés** (`app/(tabs)/saved.tsx`, refonte)

- En-tête « Enregistrés » + bouton **« + Nouvelle collection »**.
- **Grille 2 colonnes de cartes-collections (boards)** :
  - 1re carte fixe **« Tous les enregistrés »** (couverture = mosaïque des tout derniers
    enregistrés, count total).
  - Puis une carte par collection : **couverture = mosaïque 2×2** des 4 premiers modèles
    (1 grand si <2, 2 côte-à-côte si 2–3), coins arrondis ; **nom** dessous ; **count**
    en muted. Ratio carte stable.
  - État vide : invite « Crée ta première collection » + explication.
- `CollectionCard` = composant présentiel testable (props : `name`, `count`,
  `coverUrls: string[]`). `MosaicCover` = sous-composant d'agencement (helper pur
  `mosaicSlots(urls)` testé : 1/2/3/4 tuiles).
- Tap sur une carte → détail collection (ou « Tous »).

### Détail collection (`app/collection/[id].tsx`)

- Header : retour + nom + menu **«…» (Renommer / Supprimer)**.
- Masonry des modèles de la collection (réutilise `MasonryColumns`/`DesignCard`).
- État vide : « Range des modèles ici depuis tes enregistrés. »
- Renommer → petit prompt (Modal simple) ; Supprimer → confirmation.

### Sheet **« Ranger dans… »** (`CollectionPickerSheet`)

- Bottom sheet (Modal slide, même patron que `CommentsSheet` : backdrop, poignée) listant
  les collections (mini-couverture + nom + un check si le modèle y est) + une entrée
  **« + Nouvelle collection »** (saisie inline). Choisir range le modèle (`PATCH
  /me/bookmarks/:id`) et ferme.
- Ouvert depuis « Tous les enregistrés » (appui long ou bouton «…» sur une tuile) et
  depuis le détail d'un modèle (option « Ranger »). Pour ce bloc : au minimum depuis la
  vue « Tous » ; l'entrée depuis le détail modèle est un bonus si peu coûteux.

### Hooks (`src/collections/hooks.ts`)

`useCollections`, `useCollection(id)`, `useCreateCollection`, `useRenameCollection`,
`useDeleteCollection`, `useMoveBookmark` (react-query + invalidations
`['collections']`, `['collection', id]`, `['bookmarks']`).

### Cohérence design

- Tokens de thème only (sombre, coins arrondis, accent terracotta) ; typo Fraunces
  (titres) / Manrope (UI) ; `imageUri()` pour toutes les couvertures ; placeholders
  sobres. Micro-interactions : sheet qui glisse (comme les commentaires), pressions à
  0.92 d'opacité. Pas de `fontWeight`.

## Tests

- **Backend** (Vitest+Supertest, conventions repo) : créer/renommer/supprimer collection ;
  409 nom dupliqué ; 404 collection d'un autre ; `PATCH /me/bookmarks/:id` range et
  déplace ; `GET /me/collections/:id` renvoie les bons modèles ; suppression remet les
  bookmarks non classés (pas de perte).
- **Mobile** : `mosaicSlots(urls)` (1/2/3/4) ; `CollectionCard` (nom, count, tuiles de
  couverture) ; `CollectionPickerSheet` (liste + créer + sélection appelle le move).

## Hors périmètre

Multi-collections par modèle, collections publiques/partagées, réordonnancement manuel,
couverture personnalisée choisie. (Le badge Inspiration/Création = M8 ; l'algo « Pour
vous » = M2/bloc C.)

## Contraintes globales

- Prisma 6 pinné ; images relatives via `imageUri()`. Prisma/migrations + `expo export`
  sous **Node 20** (le shell retombe sur node 18). Tests API via `npm test` (pretest
  migrate). Piège babel : ASCII dans les strings des fichiers `.ts`.
- Ne pas casser les suites (API 105 / mobile 65). Réutiliser `MasonryColumns`,
  `DesignCard`, le patron `CommentsSheet` pour le sheet.
