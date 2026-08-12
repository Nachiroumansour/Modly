# Bloc D2 — Profil social — Design

_Design validé le 2026-07-15._

## Contexte

Suite du bloc D (écrans sociaux). D1 (détail « pin » social) fait. **D2** rend le
**profil social**. Constat :

- Le **profil public du tailleur** (`app/tailor/[id].tsx`, atteint depuis la ligne
  auteur de D1) est **déjà social** : avatar, nom, badge vérifié, localisation, stats
  Modèles/Abonnés, bouton Suivre, bio, spécialités, grille portfolio.
- **Mon onglet Profil** (`app/(tabs)/profile.tsx`) est encore une **liste de
  réglages** (avatar initiale, nom, rôle, quelques lignes) — pas social.

D2 socialise **mon profil** en réutilisant le style du profil public via un composant
partagé, sans changement backend (l'endpoint `GET /tailors/:id` existe et renvoie
déjà stats + bio + spécialités + modèles).

## Décisions / portée

- **Composant partagé `ProfileHero`** : bloc d'identité présentiel (avatar, nom,
  vérifié, localisation ou rôle, stats, bio, spécialités), réutilisé par les deux
  écrans profil.
- **Mon profil tailleur = ma vitrine** : récupéré via `useTailorProfile(user.id)`
  (aucun backend) → hero (stats Modèles/Abonnés, bio, spécialités) + « Mes fiches
  clients » + grille de mes modèles + CTA Publier.
- **Mon profil client** : hero (nom, rôle) + « Mes mesures ». (Il a déjà l'onglet
  Sauvegardés — on ne duplique pas.)
- **Profil public tailleur refactoré** pour utiliser `ProfileHero` (DRY, rendu
  identique) ; garde son bouton retour + bouton Suivre + « Ses modèles ».
- **Aucun changement backend.**
- **Hors périmètre** : upload d'avatar photo (reste en initiales), édition du profil
  (bio/spécialités), écran Réglages dédié / roue (les réglages restent des lignes
  inline « Bientôt » + Se déconnecter), listes abonnés/abonnements.

## Composant `ProfileHero` (`apps/mobile/src/profile/ProfileHero.tsx`)

Présentiel, pur, testable.

- Props :
  ```ts
  type Stat = { label: string; value: number };
  type Props = {
    name: string;
    roleLabel?: string;          // chip role (mon profil) : "Tailleur" / "Client"
    location?: string | null;    // localisation (profil public tailleur)
    verified?: boolean;
    stats?: Stat[];              // rangee de stats (Modeles/Abonnes)
    bio?: string | null;
    specialties?: string[];
  };
  ```
- Rendu : avatar rond (initiale de `name`), nom (+ `check-circle` accent si
  `verified`), puis — selon ce qui est fourni — un **chip rôle** (`roleLabel`) OU une
  **ligne localisation** (`location` + icône `map-pin`) ; **rangée de stats**
  (chaque `Stat` = valeur en gros + label) séparées par un trait ; **bio** (centrée) ;
  **chips spécialités**. Chaque section n'apparaît que si sa donnée est présente.
- testIDs / repères pour les tests : le nom, chaque `stat.value`/`stat.label` (texte),
  chaque spécialité (texte), la bio (texte).
- Tokens de thème only ; jamais de `fontWeight`.

## Refonte de l'onglet Profil (`apps/mobile/app/(tabs)/profile.tsx`)

- **Invité (`!user`)** : inchangé (bloc « Rejoins Moodly »).
- **Connecté** : `AppHeader` (inchangé) puis :
  - **Tailleur** : `const { tailor, designs } = useTailorProfile(user.id);`
    - `ProfileHero` avec `name`, `verified={tailor?.profile?.verified}`,
      `location={tailor?.profile?.location}`,
      `stats=[{label:'Modèles', value: tailor?.designsCount ?? 0}, {label:'Abonnés',
      value: tailor?.followersCount ?? 0}]`, `bio={tailor?.profile?.bio}`,
      `specialties={tailor?.profile?.specialties ?? []}`.
    - `TailorProfileBody` (existant, inchangé) : « Mes fiches clients » + grille des
      `designs` + CTA Publier.
    - Réglages inline : lignes « Modifier le profil » / « Notifications » / « Aide »
      (Bientôt) + **Se déconnecter**.
  - **Client** :
    - `ProfileHero` avec `name`, `roleLabel="Client"`.
    - Ligne **« Mes mesures »** → `/my-measurements`.
    - Réglages inline (« Modifier le profil » / « Notifications » / « Aide » Bientôt)
      + **Se déconnecter**.
  - Remplace l'ancien en-tête maison (avatar + nom + chip rôle) par `ProfileHero`.
  - Remplace `usePortfolio` par `useTailorProfile(user.role === 'TAILLEUR' ? user.id :
    undefined)` (même endpoint, mais expose aussi bio/spécialités/stats). L'appel reste
    **désactivé pour le client** (`enabled: Boolean(id)`), donc pas de requête inutile.

## Refonte du profil public (`apps/mobile/app/tailor/[id].tsx`)

- Remplacer le bloc `hero` maison (avatar + nom + localisation + stats + bio +
  spécialités) par `ProfileHero` (`name`, `verified`, `location`, `stats=[Modèles,
  Abonnés]`, `bio`, `specialties`).
- **Conserver** : bouton retour, bouton **Suivre/Abonné** (rendu sous le hero par
  l'écran, inchangé), section « Ses modèles » (grille).
- Objectif : zéro régression visuelle, juste la mutualisation.

## Tests (jest-expo + RNTL)

- **`ProfileHero`** (`apps/mobile/src/profile/ProfileHero.test.tsx`) :
  - affiche le nom ; affiche les valeurs + labels de stats fournis ; affiche les
    spécialités et la bio quand fournies ; **n'affiche pas** de stats/bio/spécialités
    quand non fournies ; affiche le chip rôle quand `roleLabel` fourni.
- **`TailorProfileBody`** : tests existants inchangés (le composant n'est pas modifié).
- Le câblage des écrans (profil tab, profil public) est vérifié par **typecheck +
  suite verte + revue manuelle** (les écrans-route restent testés par leur rendu
  existant ; `ProfileHero` porte la logique d'affichage testable).

## Contraintes globales

- Tokens de thème only ; jamais de `fontWeight`.
- Images relatives via `imageUri()` (n/a ici — avatars en initiales).
- Français simple.
- **Piège babel** : ASCII (pas d'apostrophe courbe U+2019) dans les strings des
  fichiers **.ts** ; `.tsx` tolère.
- Aucun changement backend ; ne pas casser les suites (99 API / 48 mobile).
- Réutiliser `useTailorProfile` (pas de nouveau hook réseau).
