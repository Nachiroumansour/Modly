# Bloc A — Média multi-format (fondation) — Design

_Design validé le 2026-07-15._

## Contexte

Modly doit être structuré comme une vraie app sociale. Le premier chantier d'une
série (A média → D écrans sociaux → C découverte → B mesures client) est le
**modèle média**, parce que c'est le changement de schéma le plus coûteux à
différer et qu'il débloque tout le rendu visuel.

Aujourd'hui `Design` porte **une seule image** (`imageUrl/imageWidth/imageHeight`).
Impossible de publier plusieurs images, un carrousel ou une vidéo. Exemple concret
soulevé par Manou : « si un tailleur publie 3 images / une vidéo, comment ça
s'affiche au home ? ».

Découpage **couche modèle vs couche infra** (comme Instagram/TikTok) :
- **Couche modèle** (ce bloc) : forme des données média + rendu.
- **Couche infra** (différée, à la mise en ligne) : object storage + CDN, rendus
  multiples/transcodage, streaming vidéo adaptatif, upload async. **Cloudinary**
  (déjà prévu) en fournit une grande partie.

## Décisions produit/portée

- **Vidéo : schéma prêt, pas de pipeline maintenant.** Le modèle supporte
  `type IMAGE | VIDEO` (+ `thumbnailUrl`, `duration`), mais on n'implémente que
  l'**upload et le rendu multi-image** dans ce bloc. Upload vidéo, génération de
  miniature et lecteur au scroll = cycle dédié ultérieur, **sans nouvelle migration**.
- **Jusqu'à 5 images** par modèle (aligné sur la référence du flow).
- **Placeholder blurhash dès maintenant** (effet flou→net façon Insta/Pinterest,
  pas de saut de layout). `expo-image` sait afficher un blurhash nativement.
- **Cover dénormalisée** sur `Design` : le feed masonry ne joint jamais la table
  `Media` (écran chaud → rapide).
- **Le carrousel swipeable du détail** n'est PAS dans ce bloc — il fait partie du
  **bloc D (écrans sociaux)** qui suit. A pose le modèle, l'upload multi, et
  l'indicateur multi-média au feed.
- **Aucune régression** sur le fix « images en chemin relatif » (helper `imageUri`).

## Modèle de données (Prisma / PostgreSQL)

### Nouveau : enum `MediaType` + table `Media`

```prisma
enum MediaType {
  IMAGE
  VIDEO
}

model Media {
  id           String    @id @default(cuid())
  design       Design    @relation(fields: [designId], references: [id], onDelete: Cascade)
  designId     String
  type         MediaType @default(IMAGE)
  url          String              // chemin relatif : /uploads/x.webp
  thumbnailUrl String?             // pour la vidéo (plus tard)
  width        Int
  height       Int
  duration     Int?                // secondes, pour la vidéo (plus tard)
  blurhash     String?             // placeholder flou
  position     Int                 // ordre dans le carrousel (0 = cover)
  createdAt    DateTime  @default(now())

  @@index([designId, position])
  @@map("media")
}
```

### `Design` — ajouts (la cover reste dénormalisée)

- On **réutilise** `imageUrl / imageWidth / imageHeight` comme **cover** (= 1er média).
- Ajouts : `coverBlurhash String?` et `mediaCount Int @default(1)`.
- Relation inverse : `media Media[]`.

Aucune colonne existante n'est supprimée → migration additive, pas de perte.

### Migration + backfill

1. Migration Prisma : crée l'enum, la table `media`, ajoute `coverBlurhash` et
   `mediaCount` à `designs`.
2. **Backfill** (script one-shot, exécuté après migrate) : pour chaque `Design`
   existant, créer **une** ligne `Media` (`type=IMAGE`, `url=imageUrl`,
   `width=imageWidth`, `height=imageHeight`, `position=0`), calculer le
   **blurhash** à partir du fichier sur disque, l'écrire sur `Media.blurhash` **et**
   sur `Design.coverBlurhash`, poser `mediaCount=1`. Couvre les 42 modèles de démo.

## API

### Génération du blurhash (`src/lib/storage.ts` ou util dédié)

- Dépendance `blurhash` (encode). Depuis le buffer image : `sharp(...).resize(32, 32,
  { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })` →
  `encode(data, width, height, 4, 3)`.
- Exposer un helper `computeBlurhash(buffer: Buffer): Promise<string>`.
- `StoredImage` gagne un champ `blurhash: string`. `LocalDiskStorage.save` calcule
  le blurhash. `CloudinaryStorage.save` peut le calculer aussi (même helper) —
  garder cohérent.

### Upload multi-images — `POST /designs`

- Passe de `upload.single` à `upload.array('media', 5)` (multer), champ **`media`**.
- Validation : **1 ≤ n ≤ 5**, chaque fichier doit être une image (le reste des
  règles existantes : titre requis, catégorie valide, etc.).
- Pour chaque fichier (dans l'ordre) : `storage.save` → `Media` (`position = i`,
  `blurhash`). Le 1er média fixe la cover du `Design`
  (`imageUrl/imageWidth/imageHeight/coverBlurhash`), `mediaCount = n`.
- Réalisé en transaction (création `Design` + `Media[]` cohérents).
- **Rétro-compat champ** : si un client envoie encore un seul fichier sous
  l'ancien champ, on renvoie une erreur claire indiquant le champ `media`
  (le mobile est mis à jour dans le même bloc, donc pas de double support durable).

### Lecture

- `designInclude` inclut `media` **ordonné par `position asc`**.
- `toApiDesign` renvoie : la cover (`imageUrl/imageWidth/imageHeight`),
  `coverBlurhash`, `mediaCount`, et `media: Media[]` (chaque item : `id`, `type`,
  `url`, `thumbnailUrl`, `width`, `height`, `duration`, `blurhash`, `position`).
- `OrderDesign` (snapshot commande) : garde `imageUrl` (cover) + ajoute
  `coverBlurhash` pour le placeholder côté commande. Pas besoin du tableau média
  complet sur les commandes.

## Mobile

### Types (`src/types.ts`)

- `type MediaType = 'IMAGE' | 'VIDEO'`.
- `type Media = { id; type: MediaType; url; thumbnailUrl: string | null; width; height; duration: number | null; blurhash: string | null; position }`.
- `Design` gagne `media: Media[]`, `coverBlurhash: string | null`, `mediaCount: number`.
- `OrderDesign` gagne `coverBlurhash: string | null`.

### `DesignCard` (feed masonry)

- Rendu inchangé côté image (cover via `imageUri(design.imageUrl)`) **+** :
  - `placeholder={{ blurhash: design.coverBlurhash ?? undefined }}` sur `<Image>`
    (flou → net). `expo-image` gère nativement.
  - **Indicateur multi-média** : petit badge (icône « pile »/`layers` ou `copy`)
    en **haut à droite** de l'image quand `design.mediaCount > 1`. Style sombre
    translucide, tokens de thème.
- Hauteur masonry = ratio de la cover (déjà le cas).

### Publication (`app/publish.tsx`)

- Sélection **1 à 5 images** (`expo-image-picker`, `allowsMultipleSelection: true`,
  `selectionLimit: 5`).
- Aperçu en ligne des images choisies (petite rangée), possibilité d'en retirer
  une avant l'envoi.
- Upload **multipart** : chaque image ajoutée au `FormData` sous le champ `media`
  (ordre = ordre de sélection), + titre/description/catégorie existants.
- États : envoi en cours, erreurs (trop d'images, aucune image, échec réseau)
  avec messages FR cohérents.

### Divers
- `imageUri` appliqué à toute `url` de média (relatif → préfixé). Déjà en place
  pour la cover ; l'étendre aux médias quand ils seront rendus (cover ici ; les
  médias eux-mêmes seront rendus au bloc D).

## Tests

### API (Vitest + Supertest)
- **Migration/backfill** : après backfill, un `Design` existant a 1 `Media`
  (`position=0`, `type=IMAGE`), `mediaCount=1`, `coverBlurhash` non nul.
- **Upload multi** : publier 3 images → 3 `Media` ordonnés (`position` 0/1/2),
  cover = 1re image, `mediaCount=3`, chaque `Media.blurhash` non nul.
- **Bornes** : 0 image → 400 ; 6 images → 400 ; fichier non-image → 400.
- **Feed/lecture** : `GET /designs` renvoie `media[]` ordonné + `coverBlurhash` +
  `mediaCount` ; `GET /designs/:id` idem.
- **Blurhash util** : `computeBlurhash(buffer)` renvoie une chaîne blurhash valide
  (préfixe/longueur plausibles) pour une image de test.

### Mobile (jest-expo + RNTL)
- `DesignCard` : affiche l'**indicateur** quand `mediaCount>1`, l'omet sinon ;
  passe `blurhash` en `placeholder` quand `coverBlurhash` présent.
- `publish` : la sélection de plusieurs images alimente le `FormData` sous `media`
  (test de la fonction de construction du `FormData`, isolée de l'UI).

## Hors périmètre (rappels)
- **Vidéo** (upload, miniature, lecteur) — schéma prêt, pipeline plus tard.
- **Carrousel swipeable du détail** — bloc D (écrans sociaux).
- **Object storage + CDN + rendus multiples + upload async** — infra de mise en
  ligne (Cloudinary).
- Algorithme du feed, contenus similaires — bloc C.

## Contraintes globales
- Aucune couleur/police en dur côté mobile (tokens `src/theme.ts`) ; jamais de
  `fontWeight`.
- Images en **chemin relatif** conservées (`imageUri` + storage relatif).
- Backend : Prisma 6 (pinné), pas de rupture des 86 tests existants.
- Français simple dans toute l'UI et les messages d'erreur.
