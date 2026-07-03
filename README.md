# Moodly

La plateforme digitale des tailleurs sénégalais — réseau social de mode
africaine + fiche client digitale + commandes.

## Démarrage

Prérequis : Node ≥ 20, Docker.

```bash
docker compose up -d        # PostgreSQL (port 5433)
npm install
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
