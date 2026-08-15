# MVP1 · M8 — Attribution des créations (Inspiration / Création originale) + publication en assistant

_Spec validée avec Manou le 15/08/2026. Référence produit : `docs/product/2026-07-16-cdc-social-commerce.md` (section « Créations originales : attribution simple et rémunération », lignes 43-59). Dernier module du MVP1._

## Objectif

Donner à chaque publication tailleur un **statut d'attribution** visible et protéger les créations originales, **sans casser la découverte visuelle** (cœur du produit). En même temps, refondre l'écran de publication en **assistant pas-à-pas façon réseau social** pour qu'il reste simple et décourage le moins possible l'utilisateur.

La **licence payante de reproduction** (« S'inspirer professionnellement », part créateur + commission Modly) **est différée au MVP2** car elle dépend du paiement (Wave/Orange Money). M8 ne fait que l'attribution + la protection visuelle.

## Décisions produit (arrêtées)

- **Deux statuts** par publication : `INSPIRATION` (contenu de découverte, source ajoutée si connue, pas de licence) et `ORIGINAL` (création originale Modly déclarée par son auteur, badge + date + lien créateur).
- **Défaut = INSPIRATION**, y compris pour les ~62 modèles déjà en base (aucune fausse revendication d'originalité ; les tailleurs passeront leurs vraies créations en `ORIGINAL` eux-mêmes).
- **Statut figé à la publication** : pas d'édition ultérieure du statut (évite de revendiquer l'originalité après coup ; cohérent avec le filigrane cuit à l'upload).
- **Protection = filigrane serveur** sur les créations originales, PAS de flou/paywall au visionnage. L'image reste pleinement visible → la découverte est intacte. Le paywall envisagé initialement devient la licence de reproduction du MVP2.
- **Photos seulement** pour M8. L'upload + lecteur vidéo (reels) reste explicitement au MVP3 ; l'étape Média de l'assistant est conçue pour accueillir la vidéo plus tard.

## Modèle de données (Prisma)

```prisma
enum PostType {
  INSPIRATION
  ORIGINAL
}

model Design {
  // … champs existants …
  postType     PostType @default(INSPIRATION)
  sourceCredit String?  // crédit texte ou lien, pertinent uniquement pour INSPIRATION
}
```

- Le badge « Création originale » affiche **date + lien créateur** → déjà couverts par `Design.createdAt` et la relation `Design.tailor`. Aucun champ supplémentaire.
- **Migration** : les lignes existantes prennent le défaut `INSPIRATION` ; `sourceCredit` NULL.

## API

### `POST /designs` (création)
- Le schéma zod `createDesignSchema` accepte deux champs optionnels :
  - `postType` : `z.enum(['INSPIRATION','ORIGINAL']).default('INSPIRATION')`
  - `sourceCredit` : `z.string().max(200).optional()`
- **Règle de cohérence serveur** : si `postType === 'ORIGINAL'`, on **ignore/vide** `sourceCredit` (une création originale n'a pas de source externe).
- Persistance des deux champs sur le `Design`.
- `toApiDesign` fait déjà un spread `...rest` → `postType` et `sourceCredit` remontent automatiquement dans le feed, le détail, les similaires, le profil. Aucun changement de sérialisation nécessaire.

### Filigrane serveur (protection des créations originales)
- Nouveau helper isolé dans le pipeline de stockage (à côté du traitement `sharp`→webp + blurhash existant), p.ex. `watermarkBuffer(buffer, label)`.
- À l'upload d'un `Design` **`ORIGINAL`**, chaque image traitée reçoit un **filigrane discret** « © {nom de l'atelier} · Modly » incrusté (coin bas-droit, opacité faible, taille proportionnelle) via composition d'un SVG texte par `sharp`, **avant** stockage.
- Le blurhash est calculé sur l'image finale (filigranée) — c'est ce que verra l'utilisateur.
- Pour `INSPIRATION` : aucun filigrane, pipeline inchangé.
- Le nom de l'atelier est connu à la création (`req.user`) → pas de dépendance externe.

## Mobile — assistant de publication (`src/publish/PublishWizard.tsx`)

Refonte de `app/publish.tsx` : le fichier de route devient un **ré-export** de `src/publish/PublishWizard.tsx` (pattern déjà utilisé pour l'auth ; un `.test.tsx` sous `app/` casserait le routing expo-router). Composant unique à **état d'étape**, sur le modèle de `SignupWizard` (points de progression, [Suivant] désactivé tant que l'étape est invalide, retour arrière sans perte de saisie).

**Au montage de l'écran (tap ⊕ Publier), la galerie s'ouvre directement.**

### Étape 1 — Média
- Sélection 1–5 photos (`expo-image-picker`, `mediaTypes: ['images']`).
- Aperçu (1re photo = couverture) + miniatures réordonnables / supprimables + bouton « ajouter ».
- Si l'utilisateur annule sans rien sélectionner : écran d'accueil engageant avec gros bouton « Choisir des photos » (jamais de cul-de-sac).
- [Suivant] actif dès **1 photo**.

### Étape 2 — L'essentiel (requis)
- Titre (`TextInput`) + catégorie (chips `DESIGN_CATEGORIES`).
- [Suivant] actif quand **titre non vide ET catégorie choisie**.

### Étape 3 — Finitions + Publier
- Type de publication : segment *Inspiration / Création originale* (défaut Inspiration ; une ligne d'explication par option).
- Si Inspiration → champ « Source (crédit) » optionnel qui apparaît.
- Si Création originale → note discrète « Un filigrane © {atelier} protégera tes photos ».
- Description (optionnelle, `multiline`).
- Bouton **Publier** toujours actif (tout le contenu de l'étape est optionnel).
- Au succès → `router.replace('/(tabs)/profile')`.

### Anti-abandon (exigences UX)
- 3 points de progression visibles (l'utilisateur voit que c'est court).
- Retour arrière conserve la saisie.
- [Suivant] grisé plutôt que messages d'erreur bloquants.
- La partie « lourde » (type / source / description) est optionnelle et reléguée en dernier.

### Hook `usePublishDesign`
- Étendu pour transmettre `postType` et `sourceCredit` dans le multipart `POST /designs`.

## Mobile — affichage de l'attribution

- **Détail modèle (`DesignScreen`)** : pour `ORIGINAL`, badge « ✦ Création originale » (nom atelier + date, tap → profil créateur, lien auteur déjà présent). Pour `INSPIRATION` avec `sourceCredit`, petite ligne « Source : … ».
- **Carte du feed (`DesignCard`)** : petit badge discret sur les créations originales (même emplacement/logique que le badge multi-média existant).
- Le filigrane étant cuit côté serveur, **rien à rendre côté mobile** pour la protection — l'image le porte déjà.

## Tests

### API
- Création `ORIGINAL` → réponse a `postType: 'ORIGINAL'`, `sourceCredit` vidé même si envoyé, helper de filigrane invoqué (spy) sur chaque image.
- Création `INSPIRATION` avec `sourceCredit` → persisté, `postType: 'INSPIRATION'`, filigrane **non** invoqué.
- Création sans champs → défaut `INSPIRATION`, `sourceCredit` NULL.
- Feed / détail exposent `postType` et `sourceCredit`.

### Mobile
- `PublishWizard` : parcourt les 3 étapes, [Suivant] désactivé aux bons moments, envoie `postType` + `sourceCredit` au hook ; l'étape 3 permet de publier une Inspiration avec source et une Création originale.
- `DesignScreen` : affiche le badge « Création originale » pour `ORIGINAL` et la ligne « Source » pour une Inspiration créditée.

## Hors périmètre (rappel)

- Licence payante de reproduction (« S'inspirer professionnellement ») → **MVP2** (dépend du paiement).
- Upload / lecteur vidéo (reels) → **MVP3**.
- Édition du statut après publication → non prévu (statut figé).
- Détection automatique de plagiat / analyse d'image → non (protection = provenance + attribution + filigrane + signalement M5).
