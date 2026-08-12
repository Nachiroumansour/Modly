# MVP1 · M2 — Feed pagination curseur + onglet Abonnements — Design

_Design validé le 2026-08-12. Réf. produit : `docs/product/2026-07-16-cdc-social-commerce.md`._

## Contexte

Le CDC exige des feeds en **pagination par curseur** (« jamais tout charger »). Le feed
Accueil est aujourd'hui en **offset** (`skip`/`take`, tri `id desc`). Il faut :
1. passer le feed en **curseur** (fondation scale + pas de doublons/sauts) ;
2. ajouter un onglet **Abonnements** (modèles des tailleurs suivis) à côté de « Pour vous ».

`GET /designs` sert **le feed ET la recherche** (`useSearch`, offset avec `page`,
`sort`, `search`, `category`). **La recherche ne doit pas casser.**

## Décisions / portée

- **Discriminateur** dans `GET /designs` : si `page` est fourni → **mode offset**
  (recherche, inchangée) ; sinon → **mode curseur** (feed).
- **« Pour vous » reste chronologique** (récent). Le vrai score algorithmique
  (suivis + récence + popularité) = plus tard (fondations reco du CDC).
- **Abonnements** = filtre sur les tailleurs suivis, curseur.
- Sans compte : « Abonnements » invite à se connecter.
- CDN / multi-résolutions = mise en ligne (hors périmètre).

## Backend — `GET /designs` (`apps/api/src/modules/designs/designs.routes.ts`)

- `feedQuerySchema` : `page` devient **optionnel sans défaut** ; ajout de
  `cursor: z.string().optional()` et `following: z.coerce.boolean().optional()`.
- **Mode offset** (si `page !== undefined`) : comportement actuel inchangé (recherche),
  réponse `{ designs, page, hasMore }`.
- **Mode curseur** (sinon) :
  - `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]` (stable).
  - `take: limit + 1`, et si `cursor` fourni : `cursor: { id: cursor }, skip: 1`.
  - `nextCursor = rows.length > limit ? rows[limit - 1].id : null`.
  - réponse `{ designs: rows.slice(0, limit).map(toApiDesign), nextCursor }`.
- **`following=1`** (nécessite auth ; 401 sinon via un check explicite — `optionalAuth`
  est déjà là, on renvoie 401 si `following` et pas de user) : `where.tailorId in
  (ids des tailleurs suivis)`. Récupérés via `prisma.follow.findMany({ where:
  { followerId: viewerId }, select: { tailorId: true } })`. Si l'utilisateur ne suit
  personne → `where.tailorId in []` → 0 résultat (état vide géré côté mobile).
- `category`/`search` restent applicables en mode curseur aussi (facultatif ; le feed
  Accueil ne les utilise pas, mais l'endpoint reste cohérent).

## Mobile

### `useFeed(scope)` (`apps/mobile/src/feed/useFeed.ts`) — passage au curseur

- Signature : `useFeed(scope: 'foryou' | 'following' = 'foryou')`.
- `useInfiniteQuery` : `initialPageParam: undefined` (pas de cursor au départ) ;
  `queryFn` appelle `/designs?limit=20` (+ `cursor=<pageParam>` si défini ; +
  `following=1` et `token` si `scope === 'following'`) ;
  `getNextPageParam: (last) => last.nextCursor ?? undefined`.
- `queryKey: ['feed', scope]`. Renvoie la même forme qu'aujourd'hui
  (`designs`, `isLoading`, `isError`, `hasMore`, `refetch`, `loadMore`).
- Type : réponse `{ designs: Design[]; nextCursor: string | null }` (nouveau type
  `FeedPage`), remplace l'usage de `Feed` (page/hasMore) dans `useFeed`. `useSearch`
  garde `Feed` (offset).

### Onglet Accueil (`app/(tabs)/feed.tsx` + `src/feed/Feed.tsx`)

- Un **segmenté « Pour vous | Abonnements »** en haut du feed (pilule, deux entrées,
  actif = accent). Composant présentiel **`FeedTabs`** (`src/feed/FeedTabs.tsx`) :
  props `{ scope, onChange, showFollowing }`. testIDs `tab-foryou`, `tab-following`.
- `Feed` reçoit un `scope` (état local dans `feed.tsx`), passe à `useFeed(scope)`.
  - **Sans compte** : « Abonnements » visible mais tape → `onRequireAuth`
    (invite connexion), OU masqué si plus simple. Décision : **visible + gate**
    (cohérent avec le reste de l'app).
  - **Abonnements vide** (connecté mais ne suit personne / aucun modèle) : état
    « Suis des tailleurs pour voir leurs nouveautés ici. »
- `feed.tsx` gère `scope` + le gate (réutilise le pattern d'auth existant du profil).

## Tests

- **Backend** (Vitest+Supertest) :
  - curseur : 1re page (limit) + `nextCursor` non nul quand il reste des modèles ; 2e
    page via `cursor` enchaîne **sans doublon** et respecte l'ordre ; `nextCursor` nul
    à la fin.
  - `following=1` : ne renvoie que les modèles des tailleurs suivis ; 401 sans auth.
  - `page=1` (recherche) : renvoie toujours `{ page, hasMore }` (non-régression).
- **Mobile** : `FeedTabs` (affiche les deux onglets, `onChange('following')` au tap,
  masque/gate selon `showFollowing`). `Feed` : tests existants conservés (mock `useFeed`).

## Contraintes globales

- Prisma 6 ; images relatives (`imageUri`). Migrations/bundle **Node 20**. Tests API
  via `npm test`. Piège babel : ASCII dans les `.ts`.
- Ne pas casser `useSearch` ni les suites (API 110 / mobile 71). Tokens de thème ;
  jamais de `fontWeight`.
- **Prochain bloc (après M2)** : connexion sociale Google (dépend d'identifiants OAuth
  à créer côté Google Cloud par Manou ; flux `expo-auth-session` en Expo Go ; schéma
  auth à assouplir — voir future spec).
