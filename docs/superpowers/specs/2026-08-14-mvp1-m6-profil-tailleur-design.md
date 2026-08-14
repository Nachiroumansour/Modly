# MVP1 · M6 — Mise en valeur du profil tailleur — Design

_Design validé le 2026-08-14. Réf. produit : `docs/product/2026-07-16-cdc-social-commerce.md` (backlog « finir MVP1 », M6)._

## Contexte

Le profil tailleur existe déjà côté données (`TailorProfile` : bio, localisation,
spécialités, années d'expérience, fourchette de prix, badge `verified`) et côté
affichage (`ProfileHero` + `GET /tailors/:id`). Mais il est **sous-exploité** :

- **Aucun écran d'édition** dans l'app. L'API `PATCH /me/profile` existe mais le mobile
  ne l'appelle jamais → un tailleur ne peut rien remplir au-delà de l'inscription.
- **`avatarUrl` n'est jamais renseigné** (aucune écriture en base) : `ProfileHero`
  n'affiche que l'initiale. Pas de photo de couverture.
- **Champs déjà en base mais non affichés** : années d'expérience, fourchette de prix.
- Une seule preuve sociale visible (Modèles, Abonnés) ; les likes cumulés n'apparaissent
  pas.

M6 = **permettre au tailleur de remplir son profil** et **le mettre en valeur** avec un
rendu **« social media »** (profil créateur façon Instagram/TikTok, thème sombre),
cohérent avec l'ADN de l'app.

## Décisions / portée

**Inclus :**
1. Écran d'édition du profil (mobile) branché sur `PATCH /me/profile`.
2. Photos **avatar** + **couverture** : upload réutilisant le pipeline image existant
   (`ImageStorage.save`) ; nouveau champ `coverUrl` sur `TailorProfile` ; rendu de la
   vraie photo dans `ProfileHero`.
3. Affichage **expérience** + **fourchette de prix** dans le profil.
4. 3ᵉ stat **« J'aime »** = somme des `likesCount` des modèles du tailleur.
5. Refonte visuelle de `ProfileHero` en profil créateur social media.

**Différé (hors périmètre M6)** — candidats M6-bis / MVP2 :
- **Modèles « à la une »** épinglés (touche le schéma `Design`, jalon à part).
- **Avis / notes** (explicitement différés MVP2 dans le CDC).
- Avatars pour les **clients** (M6 cible le profil **tailleur**).
- Recadrage/zoom d'image côté client, multi-résolutions/CDN.

## Base de données (`apps/api/prisma/schema.prisma`)

- `TailorProfile` : ajout `coverUrl String?`.
- Migration Prisma dédiée (`add_tailor_cover_url`).
- `avatarUrl` reste sur `User` (déjà présent). Aucune autre migration.

## Backend

### Upload photos — `POST /me/photos` (`users.routes.ts`)

- `requireAuth` + `requireRole('TAILLEUR')`.
- `multer` (mémoire, réutilise la config type de `designs.routes.ts` : limite taille,
  filtre image → 400 `IMAGE_INVALIDE` sinon) avec
  `upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }])`.
- Au moins un des deux fichiers requis, sinon 400 `IMAGE_REQUISE`.
- Chaque fichier passe par `ImageStorage.save(buffer)` → `{ url }`. On écrit `avatarUrl`
  sur `User` et/ou `coverUrl` sur `TailorProfile` (upsert du profil si absent).
- Réponse : `{ avatarUrl, coverUrl }` (valeurs à jour).

### `PATCH /me/profile` (existant) — inchangé

- Continue de gérer les champs texte/numériques (bio, location, specialties,
  yearsExperience, priceMin, priceMax). `coverUrl`/`avatarUrl` passent **uniquement**
  par l'upload (pas dans `profileSchema`), pour éviter d'accepter des URLs arbitraires.

### `GET /tailors/:id` (`tailors.routes.ts`) — enrichissement

- `profile` inclut désormais `coverUrl` (déjà renvoyé via `user.tailorProfile`).
- Nouveau champ **`likesTotal`** : `prisma.design.aggregate({ where: { tailorId },
  _sum: { likesCount: true } })` → `_sum.likesCount ?? 0`.
- Réponse `tailor` : ajout de `likesTotal`. Le reste inchangé.

### `GET /me` (`users.routes.ts`) — enrichissement

- Renvoie déjà `tailorProfile` (donc `coverUrl` après migration). Ajout de `likesTotal`
  (même agrégat) quand le user est TAILLEUR, pour que l'onglet Profil affiche les 3 stats
  sans second appel.

## Mobile

### Types (`src/types.ts`)

- `TailorProfile` : ajout `coverUrl: string | null`.
- `Tailor` : ajout `likesTotal: number`.

### Hooks (`src/tailors/hooks.ts` + `src/profile/`)

- `useUpdateProfile()` : mutation `PATCH /me/profile` (token), invalide
  `['tailor', id]` et `['me']`.
- `useUploadProfilePhotos()` : mutation `POST /me/photos` (multipart via `apiUpload`
  existant), invalide les mêmes clés.

### Écran d'édition — `app/profile/edit.tsx`

- Accessible depuis l'onglet Profil (bouton **« Modifier le profil »**), réservé au rôle
  TAILLEUR.
- Champs : avatar (picker + upload), couverture (picker + upload), bio (multiligne),
  localisation, spécialités (ajout/retrait de pastilles), années d'expérience, prix min /
  prix max.
- Validation miroir de `profileSchema` (bio ≤ 500, prix min ≤ prix max, etc.), messages
  FR. Enregistrement → `useUpdateProfile` ; photos → `useUploadProfilePhotos`.
- Même langage visuel sombre que le reste de l'app (`theme.ts`).

### `ProfileHero` (`src/profile/ProfileHero.tsx`) — refonte social media

- **Bannière de couverture** (`coverUrl`, ratio ~16:9 ; dégradé de repli si absente).
- **Avatar circulaire** chevauchant la bannière ; affiche `avatarUrl` si présent, sinon
  l'initiale (fallback actuel conservé).
- Nom + badge `verified`.
- **Rangée de 3 stats** : `Modèles · Abonnés · J'aime` (props `stats` déjà générique — on
  passe 3 entrées).
- Bio, **localisation**, **expérience** (« 8 ans d'expérience »), **prix**
  (« À partir de {priceMin} FCFA », ou « {priceMin}–{priceMax} FCFA » si les deux).
- Spécialités en pastilles (existant).
- Nouvelles props : `coverUrl`, `avatarUrl`, `yearsExperience`, `priceMin`, `priceMax`.

### Câblage

- `app/(tabs)/profile.tsx` : passer les nouvelles props à `ProfileHero`, ajouter le bouton
  « Modifier le profil » (TAILLEUR uniquement) → `router.push('/profile/edit')`.
- `app/tailor/[id].tsx` : passer couverture/avatar/expérience/prix + stat likes à
  `ProfileHero`.

## Gestion d'erreurs

- Upload : type non-image → 400 `IMAGE_INVALIDE` ; aucun fichier → 400 `IMAGE_REQUISE` ;
  taille excessive → 400 (limite multer). Côté mobile : message FR + réessai.
- `PATCH /me/profile` : erreurs de validation déjà normalisées (`DONNEES_INVALIDES`).
- Profil absent lors d'un upload cover : upsert du `TailorProfile`.

## Tests

**API (`apps/api/tests/`)** :
- `POST /me/photos` : upload avatar seul, cover seul, les deux ; met à jour `avatarUrl` /
  `coverUrl` ; 400 sans fichier ; 400 fichier non-image ; 403 pour un CLIENT.
- `GET /tailors/:id` : `likesTotal` = somme des likes des modèles ; `coverUrl` renvoyé.
- `GET /me` : `likesTotal` présent pour un TAILLEUR.
- `PATCH /me/profile` : n'accepte pas `coverUrl`/`avatarUrl` (ignorés/rejetés).

**Mobile (`apps/mobile/src/`)** :
- `ProfileHero` : rend couverture + avatar image quand fournis ; fallback initiale ;
  affiche expérience et prix ; 3 stats.
- Écran d'édition : validation (prix min > max → erreur), soumission appelle
  `useUpdateProfile`.

## Vérification

- `apps/api` : `npm run typecheck` + `npm test` verts (migration test appliquée).
- `apps/mobile` : `npx tsc --noEmit` + `npx jest` verts.
