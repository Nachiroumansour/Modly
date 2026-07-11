# Moodly

La plateforme digitale des tailleurs sénégalais — réseau social de mode
africaine + fiche client digitale + commandes.

## Démarrage

Prérequis : Node ≥ 20, Docker.

```bash
docker compose up -d        # PostgreSQL (port 5433)
npm install
cp apps/api/.env.example apps/api/.env
cd apps/api && npx prisma migrate dev && cd ../..
npm run dev:api             # API sur http://localhost:3000
```

## Tests

```bash
npm test
```

## Structure

- `apps/api` — API Express + Prisma/PostgreSQL
- `apps/mobile` — app Expo (jalon 4)
- `packages/shared` — constantes et types métier partagés
- `docs/superpowers/specs` — design validé
- `docs/superpowers/plans` — plans d'implémentation par jalon

## API (jalon 2)

- `GET /designs` — feed public (filtres `category`, `search`, `sort=recent|tendance`, pagination `page`/`limit`)
- `POST /designs` — publier un modèle (tailleur, multipart `image` + `title` + `category`)
- `GET /designs/:id` — détail + commentaires
- `POST|DELETE /designs/:id/like` et `/bookmark` — réactions idempotentes
- `GET|POST /designs/:id/comments` — commentaires
- `GET /me/bookmarks` — mes modèles sauvegardés
- `POST|DELETE /tailors/:id/follow` — suivre un tailleur
- `GET /tailors/:id` — profil public (portfolio, followers)
- `PATCH /me/profile` — éditer son profil tailleur

Sans `CLOUDINARY_URL`, les images sont stockées dans `apps/api/uploads/` et servies sur `/uploads`.
