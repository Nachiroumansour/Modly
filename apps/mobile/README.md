# Moodly — app mobile (Expo)

App Expo (expo-router, TypeScript) de Moodly. Tranche 1 du jalon 4 : feed public
façon Pinterest, détail d'un modèle, inscription/connexion.

## Design

- **Home / feed = façon Pinterest** : grille masonry, ratio d'image réel, images d'abord.
- **Autres écrans = façon TikTok** : plein écran, sombre, gros boutons.
- **Design system** dans `src/theme.ts` : neutres premium + une seule couleur d'accent (terracotta). Toujours passer par ces tokens.

## Lancer l'app

1. **Démarrer l'API** (depuis la racine du repo) :
   ```bash
   npm run dev:api
   ```
   (Postgres via Docker doit tourner : `docker compose up -d db`.)

2. **Régler la base URL de l'API.** Sur un vrai téléphone via Expo Go, `localhost`
   pointe vers le téléphone — il faut l'**IP LAN de ta machine** :
   ```bash
   # exemple ; remplace par ton IP (icône Wi-Fi → réglages réseau)
   export EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
   ```
   Sans réglage, la valeur par défaut est `http://localhost:3000` (OK pour un simulateur iOS sur la même machine).

3. **Lancer Expo** :
   ```bash
   npm run start -w @moodly/mobile
   ```
   Scanne le QR code avec l'app **Expo Go** (iOS/Android), ou appuie sur `i` / `a`
   pour un simulateur.

## Vérifier (manuellement, sur ton téléphone)

- [ ] L'app **s'ouvre sur le feed** (grille Pinterest), navigable **sans compte**.
- [ ] Le scroll charge **plus de modèles** (pagination).
- [ ] Toucher une carte ouvre le **détail plein écran** (image, compteurs, commentaires).
- [ ] Sur le détail, « Commander ce modèle » / « J'aime » **invite à s'inscrire**.
- [ ] L'**inscription** (choix du rôle) puis la **connexion** fonctionnent et reviennent au feed.
- [ ] Couper l'API → le feed affiche un message clair + bouton **« Réessayer »** (jamais d'écran blanc).

## Développer

```bash
npm run typecheck -w @moodly/mobile   # TypeScript strict
npm test -w @moodly/mobile            # tests jest-expo + RNTL
```
