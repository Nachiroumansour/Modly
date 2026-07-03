# Moodly — Design MVP 1

**Date** : 3 juillet 2026
**Statut** : validé section par section avec Manou
**Source** : `Modly_Cahier_des_Charges.docx` (v1.0, mai 2026)

## 1. Objectif

Construire le MVP 1 de Moodly, la plateforme mobile des tailleurs sénégalais :
un réseau social de mode africaine (style Pinterest) combiné à un outil de
gestion d'atelier (fiche client digitale, commandes).

### Périmètre du MVP 1

| Module | Contenu |
|---|---|
| Auth | Inscription/connexion, 2 rôles : Tailleur et Client |
| Feed communauté | Grille masonry 2 colonnes, recherche, filtres par catégorie |
| Interactions sociales | Likes, commentaires, sauvegardes, follow/followers, partage |
| Profil tailleur | Portfolio, infos publiques, publication de modèles |
| Fiche client digitale | 15 mesures (saisie manuelle, versionnée), préférences, notes |
| Commandes basiques | Modèle → tailleur → mesures → confirmation, suivi par étapes |

### Hors périmètre (phases suivantes)

Mesure par IA (MediaPipe), essayage virtuel, notifications push FCM (la
structure de données est prévue, l'envoi viendra en V1.0), messagerie
intégrée, système d'avis/notes, badge vérifié, paiement mobile, mode offline
complet avec synchronisation.

## 2. Principe UX — « Facile comme TikTok »

Exigence forte de Manou : l'app doit être aussi simple d'usage que TikTok.

- **Le feed d'abord** : l'app s'ouvre sur le feed de modèles, consultable
  sans compte. L'inscription n'est demandée qu'au moment d'agir (liker,
  commenter, commander).
- **Inscription en 30 secondes** : téléphone + prénom + mot de passe + choix
  du rôle. Le profil se complète plus tard.
- **Zéro texte superflu** : grandes images, gros boutons, icônes universelles
  (cœur, bulle, signet), une seule action principale par écran.
- **Gestes naturels** : scroll infini, double-tap pour liker, pull-to-refresh.
- **Parcours tailleur en 3 gestes** : publier un modèle = photo → catégorie →
  publier. Créer une fiche client = nom → téléphone → mesures.
- **Français simple**, vocabulaire du métier, pas de jargon technique.

## 3. Architecture

```
moodly/
├── apps/
│   ├── mobile/          # Expo (React Native + TypeScript)
│   └── api/             # Node.js + Express (TypeScript)
└── packages/
    └── shared/          # Types partagés (mesures, statuts, catégories)
```

### Mobile — Expo + TypeScript

- **expo-router** : navigation par fichiers
- **React Query** : cache serveur (feed, profils), persisté pour tolérer le
  réseau faible — les données déjà vues restent visibles hors ligne
- **Zustand** : état local léger (session utilisateur)
- Compression des images côté mobile avant upload (3G friendly)

### API — Express + TypeScript

- **Prisma** : ORM PostgreSQL (migrations, types générés)
- **JWT** : access token courte durée + refresh token
- **Zod** : validation de toutes les entrées
- **Cloudinary** : le mobile envoie l'image à l'API, l'API la stocke sur
  Cloudinary et conserve l'URL + dimensions (nécessaires à la grille masonry)

### Base de données — PostgreSQL

- Développement : Docker local
- Production : Neon ou Railway (tier gratuit), décision au moment du déploiement

## 4. Modèle de données

### Comptes et profils

- **`users`** : id, téléphone (identifiant de connexion — norme locale),
  mot de passe hashé (bcrypt), nom, photo optionnelle, rôle (`TAILLEUR` |
  `CLIENT`), email optionnel.
- **`tailor_profiles`** (1 par tailleur) : bio, localisation
  (quartier/ville), spécialités, années d'expérience, fourchette de tarifs,
  badge vérifié (false au MVP).

### Communauté

- **`designs`** : tailleur, titre, description, catégorie (`BOUBOU`, `ROBE`,
  `ENSEMBLE`, `ENFANT`, `MARIAGE`, `TABASKI`, `KORITE`, `MAGAL`), URL image
  Cloudinary + largeur/hauteur, compteurs dénormalisés (likes, commentaires,
  sauvegardes).
- **`likes`**, **`bookmarks`** : (user, design) avec contrainte d'unicité.
- **`comments`** : user, design, texte, date.
- **`follows`** : (follower, tailleur suivi) avec contrainte d'unicité.

### Cœur métier

- **`client_records`** — la fiche client, propriété d'un tailleur. Lien
  *optionnel* vers un compte `users` : le tailleur peut créer une fiche pour
  un client qui n'a pas l'app (nom + téléphone suffisent). Préférences
  (style, tissu, coupe) et notes libres.
- **`measurements`** — versionnées : chaque mise à jour crée une nouvelle
  ligne (historique visible). Champs : fiche client, source (`MANUELLE`,
  plus tard `IA`), date, et 15 mesures numériques en cm :
  tour de poitrine, tour de taille, tour de hanches, largeur d'épaules,
  longueur de bras, tour de bras, tour de cou, entrejambe, longueur de
  jambe, longueur de boubou, longueur de chemise, tour de cuisse, tour de
  poignet, carrure dos, longueur de manche.
- **`orders`** : client (compte app), tailleur, modèle choisi (optionnel —
  commande libre possible), fiche client liée, **copie figée des mesures**
  au moment de la commande, prix convenu, statut de paiement (`EN_ATTENTE`,
  `ACOMPTE`, `PAYE`), date de livraison estimée. Statut de production :
  `EN_ATTENTE` → `TISSU_RECU` → `COUPE` → `COUTURE` → `FINITIONS` → `PRET`
  → `LIVREE` (+ `ANNULEE`).
- **`order_events`** : historique des changements de statut (timeline de
  suivi côté client).

## 5. API REST

### Auth

- `POST /auth/register` — téléphone, mot de passe, nom, rôle
- `POST /auth/login`, `POST /auth/refresh`

### Feed & communauté

- `GET /designs` — pagination infinie, `?category=`, `?search=`, tri
  récent/tendance ; accessible sans authentification
- `POST /designs` — publier (tailleur), upload image
- `GET /designs/:id` — détail + commentaires
- `POST|DELETE /designs/:id/like`, `POST|DELETE /designs/:id/bookmark`
- `GET|POST /designs/:id/comments`
- `POST|DELETE /tailors/:id/follow`
- `GET /me/bookmarks`

### Profils

- `GET /tailors/:id` — profil public (portfolio, stats, followers)
- `PATCH /me/profile`

### Fiches clients (rôle tailleur requis)

- `GET|POST /client-records`, `GET|PATCH|DELETE /client-records/:id`
- `POST /client-records/:id/measurements` — nouvelle version
- `GET /client-records/:id/measurements` — historique

### Commandes

- `POST /orders` (client), `GET /orders` (vue selon rôle)
- `PATCH /orders/:id/status` (tailleur)
- `GET /orders/:id` — détail + timeline

Règles transverses : JWT obligatoire sauf auth et lecture du feed ; contrôle
de rôle sur les actions tailleur ; contrôle de propriété systématique (un
tailleur ne voit que ses fiches, un client que ses commandes).

## 6. Écrans mobiles (expo-router)

**Communs** : Bienvenue → Feed public → Inscription (choix du rôle) → Connexion.

**Onglets Client** : Accueil (feed masonry, recherche, filtres) ·
Sauvegardés · Commandes (liste + timeline) · Profil (infos, mes mesures).

**Onglets Tailleur** : Accueil (même feed) · Mes modèles (portfolio +
« Publier un modèle ») · Clients (fiches → détail → formulaire 15 mesures) ·
Commandes (reçues + changement de statut) · Profil public éditable.

**Transverses** : détail d'un modèle (plein écran, like/commentaire/
sauvegarde/partage, bouton « Commander ce modèle ») ; profil public d'un
tailleur ; flux de commande en 3 étapes (modèle → mesures → confirmation).

## 7. Gestion des erreurs et sécurité

- Toute erreur réseau affiche un message clair en français + bouton
  « Réessayer » — jamais d'écran blanc.
- Mots de passe bcrypt, JWT courte durée + refresh.
- Validation Zod sur toutes les entrées, limite de taille des uploads.
- Réponses d'erreur API normalisées : `{ error: { code, message } }`.

## 8. Stratégie de tests

- **API** : tests d'intégration sur chaque endpoint (Vitest + Supertest,
  base Postgres de test). C'est là que vit la logique critique
  (autorisations, versionnage des mesures, transitions de statut).
- **Mobile** : React Native Testing Library sur les composants clés
  (formulaire des 15 mesures, flux de commande).
- Vérification manuelle sur téléphone via Expo Go à chaque jalon.
- Développement en TDD (superpowers:test-driven-development).

## 9. Prochaine étape

Plan d'implémentation détaillé via le skill superpowers:writing-plans,
découpé en jalons livrables (auth → feed → social → fiches clients →
commandes).
