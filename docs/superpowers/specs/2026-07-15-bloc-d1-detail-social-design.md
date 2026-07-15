# Bloc D1 — Détail « pin » social — Design

_Design validé le 2026-07-15._

## Contexte

Suite du chantier « vraie app sociale » (A média ✅ → **D écrans sociaux** → C
découverte → B mesures client). Bloc D découpé en deux cycles : **D1** l'écran
détail façon « pin » (référence Pinterest partagée par Manou), **D2** le profil
social (cycle suivant).

L'écran détail actuel (`apps/mobile/src/design/DesignScreen.tsx`) est fonctionnel
(like/save/commentaire, CTA Commander) mais **mono-image** et pas « pin social ».
Le bloc A a posé le modèle média (`design.media[]`, cover, blurhash) ; D1 le rend
enfin visible (carrousel) et transforme l'écran en vrai détail social.

## Portée / décisions

- **Carrousel** des médias du bloc A (repli sur la cover si `media` vide).
- **Barre d'actions sociale** : like + compteur, commentaire + compteur, partage,
  enregistrer. Remplace les 2 boutons fantômes + la ligne de stats actuels.
- **Double-tap sur l'image = like** (touche sociale, comme Insta).
- **Ligne auteur** (avatar initiale + nom) → profil du tailleur.
- **« Explorer davantage »** : grille masonry de modèles **similaires** (nouvel
  endpoint), chaque tuile ouvre son détail.
- **Partage** : feuille de partage **native** (`Share.share`) avec un texte
  « {titre} par {tailleur} sur Modly ». Elle expose déjà WhatsApp + « copier ».
  Un vrai lien web partageable viendra avec la mise en ligne (hors périmètre).
- **Similaires (v1, sans ML)** : d'abord les autres modèles du **même tailleur**,
  puis complétés par la **même catégorie**, en excluant le modèle courant,
  dédupliqués, tri récent.
- On **garde** les commentaires et le CTA « Commander ce modèle ».
- **Hors périmètre** : profil social (**D2**), liens web partageables, lecture
  vidéo (schéma prêt, pas de lecteur), algorithme de recommandation (bloc C).

## Backend

### Endpoint `GET /designs/:id/similar`

- Route dans `apps/api/src/modules/designs/designs.routes.ts`, **auth optionnelle**
  (`optionalAuth`) pour renseigner `likedByMe`/`bookmarkedByMe`.
- Query : `limit` (défaut 12, max 30).
- Logique (dans un service testable `getSimilarDesigns`) :
  1. Vérifier que le design existe (404 sinon) ; récupérer son `tailorId` + `category`.
  2. **A** = autres modèles du même tailleur (exclut le courant), tri `createdAt desc`.
  3. **B** = modèles de la même catégorie (exclut le courant **et** les ids déjà
     dans A), tri `createdAt desc`.
  4. Concaténer `A` puis `B`, tronquer à `limit`.
  5. Mapper via `toApiDesign` (avec `designInclude(viewerId)`) → cartes complètes
     (cover + `media[]` + `mediaCount` + `coverBlurhash`).
- Réponse : `{ designs: ApiDesign[] }`.
- **Tests** (Vitest+Supertest, conventions repo : `createApp()`, `registerUser`,
  `makeTestImage`, seed `beforeEach`) :
  - Priorité tailleur : un modèle du même tailleur passe **avant** un modèle
    d'un autre tailleur de la même catégorie.
  - Le modèle courant est **exclu** ; pas de doublon entre A et B.
  - `limit` respecté ; design inexistant → 404.

## Mobile

### `useSimilar(id)` — `apps/mobile/src/design/useSimilar.ts`

- react-query `useQuery(['similar', id])` → `apiFetch<{ designs: Design[] }>(
  \`/designs/${id}/similar\`, { token })`. Renvoie `{ designs, isLoading, isError }`.

### Refonte `DesignScreen` (`apps/mobile/src/design/DesignScreen.tsx`)

Composée d'unités testables :

- **`MediaCarousel`** (`apps/mobile/src/design/MediaCarousel.tsx`) : liste
  horizontale paginée (`FlatList` `horizontal pagingEnabled`) sur un tableau de
  médias ; si `media` vide, repli sur un seul média synthétique construit depuis la
  cover (`imageUrl/imageWidth/imageHeight/coverBlurhash`). Chaque page : `Image`
  plein cadre (ratio du **1er** média pour une hauteur stable), `placeholder`
  blurhash, `imageUri(url)`. **Points de pagination** superposés en bas quand
  `media.length > 1` (testID `carousel-dots`, un point actif). Props :
  `{ media, cover, onDoubleTapLike }`. Double-tap → `onDoubleTapLike`.
- **`SocialActionBar`** (`apps/mobile/src/design/SocialActionBar.tsx`) : rangée
  d'actions présentielle (pure, testable) — like (icône `heart`, accent + rempli si
  `liked`, + `likesCount`), commentaire (`message-circle` + `commentsCount`),
  partage (`share`), enregistrer (`bookmark`, accent si `saved`, + `bookmarksCount`).
  Props : `{ liked, saved, likesCount, commentsCount, bookmarksCount, onLike,
  onComment, onShare, onSave }`. testIDs : `action-like`, `action-comment`,
  `action-share`, `action-save`.
- **`DesignScreen`** assemble : `MediaCarousel` (avec bouton retour superposé) →
  titre → **ligne auteur** (avatar initiale + nom, pressable → `onTailor`) →
  `description` → `SocialActionBar` → **section « Explorer davantage »**
  (`MasonryColumns` des similaires via `useSimilar`, ouverture d'un similaire via un
  nouveau prop `onOpenDesign(id)`) → **commentaires** (inchangés) → CTA
  « Commander ce modèle ».
  - Actions câblées sur `useDesignActions` existant : like/bookmark/commentaire.
    `onShare` → `Share.share({ message: \`${design.title} par ${design.tailor.name} sur Modly\` })`.
  - `onComment` → focus/scroll vers la zone commentaires (repère par `ref`).
  - Sans compte : like/save/commentaire invitent à se connecter (`onRequireAuth`),
    comportement existant conservé.
- **Câblage route** : `apps/mobile/app/design/[id].tsx` passe `onOpenDesign={(sid) =>
  router.push(\`/design/${sid}\`)}` (push d'un similaire).

### Tests mobile (jest-expo + RNTL)

- `MediaCarousel` : rend N pages pour N médias ; affiche `carousel-dots` quand
  `media.length > 1`, les masque pour 1 seul ; repli cover quand `media` vide.
- `SocialActionBar` : affiche les compteurs ; l'état `liked`/`saved` applique
  l'accent ; chaque bouton déclenche son handler (testIDs).
- `DesignScreen` (hooks `useDesign`/`useSimilar`/`useDesignActions` mockés,
  safe-area mockée) : rend le titre, la ligne auteur (press → `onTailor`), la
  section similaires (une tuile → `onOpenDesign`), et la barre d'actions.

## Contraintes globales

- Tokens de thème only (`src/theme.ts`) ; jamais de `fontWeight`.
- Images en **chemin relatif** → toujours via `imageUri()`.
- Français simple dans l'UI.
- Backend : Prisma 6 pinné ; ne pas casser les suites (96 API / 42 mobile).
- **Piège babel** : pas d'apostrophe courbe U+2019 dans les strings des fichiers
  **.ts** (casse le tokenizer) ; ASCII en `.ts`, `.tsx` tolère.
- Réutiliser `MasonryColumns` (`src/feed/masonry`) et `DesignCard` pour la grille
  des similaires (cohérence avec le feed : tuiles arrondies, badge multi-média,
  blurhash).
