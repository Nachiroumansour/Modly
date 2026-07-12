# Jalon 4 (tranche 1) — App mobile : cœur démontrable

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Frontend : le cycle TDD est adapté — tests **React Native Testing Library** (jest-expo) + **typecheck** à chaque tâche ; le rendu visuel réel se vérifie manuellement sur téléphone via **Expo Go** (je ne peux pas le rendre dans cet environnement).

**Goal:** Livrer la première tranche visible de Moodly : une app Expo qui **s'ouvre sur le feed public** (navigable **sans compte**), permet de **voir le détail d'un modèle**, et de **s'inscrire / se connecter** (choix du rôle, token stocké en sécurité). Elle consomme l'API des jalons 1-2 déjà en production.

**Langage visuel (directive Manou) :**
- **Home = exactement comme Pinterest** : grille masonry à colonnes, hauteurs d'images variées (ratio réel préservé), images d'abord, très peu de texte/chrome, scroll fluide et dense.
- **Recherche, profil, détail et écrans immersifs = façon TikTok** : plein écran, fond sombre, gros boutons/gestes, superpositions minimalistes, immersif. Ce langage s'applique à toutes les tranches suivantes du jalon 4.

**Architecture:** Nouvelle app `apps/mobile` (workspace npm) en **Expo SDK 54+ / expo-router / TypeScript**. Client API `fetch` typé pointant vers `EXPO_PUBLIC_API_URL` (défaut `http://localhost:3000`). Auth : token d'accès stocké via `expo-secure-store`, exposé par un `AuthContext`. Données du feed via **@tanstack/react-query** (pagination infinie, états chargement/erreur/vide). Constantes/types partagés depuis `@moodly/shared`. Metro configuré pour le monorepo (résolution des workspaces).

**Tech Stack:** Expo, expo-router, expo-secure-store, @tanstack/react-query, @moodly/shared. Tests : jest-expo + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-07-03-moodly-mvp-design.md` (section « Écrans mobiles » + « Principe UX — facile comme TikTok »).
**Prérequis:** Jalons 1-2-3-5 backend mergés dans `main`. API démarrable via `npm run dev:api`. Branche `jalon-4-mobile` depuis `main`.

## Global Constraints

- TypeScript strict. Français partout dans l'UI, textes simples, gros boutons (exigence « facile comme TikTok »).
- Le feed et le détail se consultent **sans compte** ; l'inscription n'est demandée qu'au moment d'agir (liker/commenter/commander — ces actions arrivent dans les tranches suivantes).
- Toute erreur réseau → message clair en français + bouton « Réessayer », jamais d'écran blanc.
- L'app ne stocke JAMAIS le mot de passe ; uniquement le token d'accès (secure-store).
- Base URL configurable (`EXPO_PUBLIC_API_URL`) : sur un vrai téléphone via Expo Go, `localhost` ne marche pas → utiliser l'IP LAN de la machine ; documenté dans le README.
- Commits français, préfixes `feat:`/`fix:`/`test:`/`chore:`, terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Chemins relatifs à `/Users/macbook_1/devperso/Moodly`. Vérifs : `npm run typecheck -w apps/mobile` et `npm test -w apps/mobile`.

### Hors périmètre de cette tranche (tranches suivantes du jalon 4)

Onglets rôle (tailleur/client), publication de modèle, like/commentaire/sauvegarde, follows, fiches & formulaire 15 mesures, flux de commande + timeline. Ici : **feed public + détail + auth** seulement.

---

### Task 1: Échafaudage Expo dans le monorepo

**Files:** `apps/mobile/*` (généré), `apps/mobile/package.json`, `apps/mobile/metro.config.js`, `apps/mobile/tsconfig.json`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`.

- [ ] **Step 1: Générer l'app** — depuis la racine :
  `npx create-expo-app@latest apps/mobile --template blank-typescript --no-install`
  (si le dossier pose souci, générer dans un temp puis déplacer). Objectif : app expo-router TS minimale.
- [ ] **Step 2: Intégrer au monorepo** — nommer le package `@moodly/mobile` (privé) ; ajouter `metro.config.js` avec `watchFolders` = racine et `nodeModulesPaths` (racine + local) pour résoudre les workspaces ; `tsconfig.json` étend `../../tsconfig.base.json` ; installer les deps depuis la racine (`npm install`).
- [ ] **Step 3: Écran d'accueil provisoire** — `app/index.tsx` affiche « Moodly » (placeholder), `app/_layout.tsx` = Stack expo-router.
- [ ] **Step 4: Vérifier** — `npm run typecheck -w apps/mobile` → 0 erreur. `npx expo export --platform web` OU au minimum le typecheck passe (le lancement device est manuel).
- [ ] **Step 5: Commit** — `chore: échafaudage app mobile Expo (expo-router, TS, monorepo)`

---

### Task 2: Client API + configuration

**Files:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/config.ts`, `apps/mobile/src/types.ts`, test `apps/mobile/src/lib/api.test.ts`.

**Produces:** `apiFetch(path, { method, body, token })` qui préfixe la base URL, met le header `Authorization` si token, parse le JSON, et **jette une erreur normalisée** `{ code, message }` en cas de `error` API ou d'échec réseau (message français par défaut). `config.API_URL` lit `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'`. Types `Design`, `Feed`, `AuthResponse`, `ApiUser` alignés sur l'API.

- [ ] **Step 1: Test** — `api.test.ts` : mocker `fetch` global ; vérifier (a) succès renvoie le JSON ; (b) réponse `{ error: { code, message } }` → l'erreur jetée porte `code`/`message` ; (c) `fetch` qui rejette → message « Connexion impossible. Réessaie. ».
- [ ] **Step 2: Rouge** — `npm test -w apps/mobile`.
- [ ] **Step 3: Implémenter** `config.ts`, `api.ts`, `types.ts`.
- [ ] **Step 4: Vert** + typecheck.
- [ ] **Step 5: Commit** — `feat(mobile): client API typé + gestion d'erreurs en français`

---

### Task 3: Auth — stockage sécurisé, contexte, écrans inscription/connexion

**Files:** `apps/mobile/src/auth/AuthContext.tsx`, `apps/mobile/src/auth/storage.ts`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/register.tsx`, tests `AuthContext.test.tsx`.

**Produces:** `AuthProvider` + `useAuth()` exposant `{ user, token, register(), login(), logout(), loading }`. Token persistant via `expo-secure-store` (mock en test). Écrans : inscription (téléphone, prénom, mot de passe, **choix du rôle** Tailleur/Client via gros boutons) et connexion (téléphone + mot de passe). Erreurs API affichées en français ; bouton « Réessayer ».

- [ ] **Step 1: Test** — `AuthContext.test.tsx` : mocker `apiFetch` + secure-store ; `login()` réussi stocke le token et peuple `user` ; `logout()` efface. (RNTL `renderHook`/`act`.)
- [ ] **Step 2: Rouge.**
- [ ] **Step 3: Implémenter** contexte, storage, écrans. Router : `(auth)` en groupe modal ; redirection après succès vers le feed.
- [ ] **Step 4: Vert** + typecheck.
- [ ] **Step 5: Commit** — `feat(mobile): inscription/connexion avec token sécurisé et choix du rôle`

---

### Task 4: Feed public (masonry, pagination, états)

**Files:** `apps/mobile/app/index.tsx` (feed), `apps/mobile/src/components/DesignCard.tsx`, `apps/mobile/src/feed/useFeed.ts`, `apps/mobile/src/ui/ErrorRetry.tsx`, tests `DesignCard.test.tsx`, `Feed.test.tsx`.

**Produces:** Écran d'accueil = feed public. `useFeed()` (react-query `useInfiniteQuery`) appelle `GET /designs?page=&limit=`. Grille masonry 2 colonnes de `DesignCard` (image ratio préservé, titre, nom du tailleur). États : chargement (spinner), erreur (`ErrorRetry` : message FR + « Réessayer »), vide (« Aucun modèle pour l'instant. »). Barre de recherche + filtres catégorie = **tranche suivante** (juste la structure ici si simple). Chaque carte navigue vers `/(design)/[id]`.

- [ ] **Step 1: Test** — `DesignCard.test.tsx` (rend titre + tailleur, calcule le ratio) ; `Feed.test.tsx` (mock `useFeed` : affiche les cartes ; état erreur affiche « Réessayer » ; état vide).
- [ ] **Step 2: Rouge.**
- [ ] **Step 3: Implémenter** `QueryClientProvider` (dans `_layout`), `useFeed`, `DesignCard`, `ErrorRetry`, l'écran feed.
- [ ] **Step 4: Vert** + typecheck.
- [ ] **Step 5: Commit** — `feat(mobile): feed public masonry avec pagination et états d'erreur`

---

### Task 5: Détail d'un modèle (plein écran)

**Files:** `apps/mobile/app/design/[id].tsx`, `apps/mobile/src/design/useDesign.ts`, test `Design.test.tsx`.

**Produces:** Écran détail plein écran : grande image, titre, catégorie, nom + avatar du tailleur, compteurs (likes/commentaires/sauvegardes), liste des commentaires (lecture seule ici). Boutons like/commenter/sauvegarder/« Commander » **présents mais qui invitent à se connecter** (l'action réelle = tranche suivante). `GET /designs/:id`. États chargement/erreur.

- [ ] **Step 1: Test** — `Design.test.tsx` : mock `useDesign` → rend titre, tailleur, compteurs, commentaires ; état erreur → « Réessayer ».
- [ ] **Step 2: Rouge.**
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Vert** + typecheck.
- [ ] **Step 5: Commit** — `feat(mobile): écran détail d'un modèle (image, compteurs, commentaires)`

---

### Task 6: Finition de la tranche

**Files:** `apps/mobile/README.md` (ou section du README racine).

- [ ] **Step 1: Typecheck + tests** — `npm run typecheck -w apps/mobile && npm test -w apps/mobile` ; noter le nombre de tests.
- [ ] **Step 2: Instructions de lancement** — documenter : démarrer l'API (`npm run dev:api`), régler `EXPO_PUBLIC_API_URL` sur l'IP LAN de la machine pour Expo Go, lancer `npm run start -w apps/mobile`, scanner le QR code. Préciser que la vérification visuelle se fait sur téléphone.
- [ ] **Step 3: Vérification manuelle (côté utilisateur)** — check-list à remettre : l'app ouvre sur le feed, une carte ouvre le détail, l'inscription puis la connexion fonctionnent. (Non exécutable ici : à confirmer par Manou sur son téléphone.)
- [ ] **Step 4: Commit** — `chore(mobile): README de lancement (Expo Go, API_URL LAN)`

---

## Definition of Done (jalon 4 — tranche 1)

- [ ] `apps/mobile` échafaudée (Expo/expo-router/TS), intégrée au monorepo, typecheck 0 erreur.
- [ ] Client API typé + erreurs françaises ; base URL configurable.
- [ ] Auth complète (inscription avec choix du rôle, connexion, token sécurisé) avec tests.
- [ ] Feed public masonry paginé + états chargement/erreur/vide ; navigation vers le détail.
- [ ] Écran détail (image, compteurs, commentaires en lecture) ; boutons d'action invitant à se connecter.
- [ ] Tests RNTL verts ; README de lancement Expo Go à jour.
- [ ] Branche `jalon-4-mobile` prête pour PR ; vérification visuelle déléguée à Manou (Expo Go).
