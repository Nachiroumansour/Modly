# MVP1 · M3 — Commentaires hiérarchisés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Passer les commentaires en hiérarchie sociale : réponses (1 niveau), like de commentaire, épingle par le tailleur, suppression par l'auteur.

**Architecture:** `Comment` gagne `parentId`/`likesCount`/`pinned` + table `CommentLike`. Service threadé + endpoints (POST avec parentId, GET arborescent, like/delete/pin). Mobile : hook `useComments`, `CommentItem` présentiel, `CommentsSheet` devient un conteneur.

**Tech Stack:** Express 5 + Prisma 6 ; Expo SDK 54 ; Vitest+Supertest, jest-expo+RNTL.

## Global Constraints

- Prisma 6 ; migrations/bundle **Node 20** (`PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH"`) ; tests API via `npm test`. Piège babel : ASCII dans les `.ts`. Tokens de thème ; jamais de `fontWeight`. Ne pas casser les suites (API 113 / mobile 73). Conventions tests API : `createApp()`, `registerUser`, seed `beforeEach`.

---

### Task 1: Schéma — `Comment` (parentId/likesCount/pinned) + `CommentLike` + migration

**Files:** Modify `apps/api/prisma/schema.prisma` ; migration générée.

- [ ] **Step 1: DB up** — `docker compose up -d`.

- [ ] **Step 2: Éditer le schéma**

Dans `model Comment`, ajouter :

```prisma
  parentId  String?
  parent    Comment?    @relation("replies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[]   @relation("replies")
  likesCount Int        @default(0)
  pinned    Boolean     @default(false)
  likes     CommentLike[]
```

Ajouter le modèle :

```prisma
model CommentLike {
  id        String   @id @default(cuid())
  userId    String
  commentId String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, commentId])
  @@index([commentId])
  @@map("comment_likes")
}
```

Dans `model User`, ajouter `commentLikes CommentLike[]`.

- [ ] **Step 3: Migration + client (Node 20)**

Run: `cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" npx dotenv -e .env -- prisma migrate dev --name add_comment_hierarchy`

- [ ] **Step 4: Non-régression** — `PATH=…node20… npx tsc --noEmit && PATH=…node20… npm test` (113, additif).

- [ ] **Step 5: Commit** — `git add apps/api/prisma/schema.prisma apps/api/prisma/migrations && git commit -m "feat(api): schéma commentaires hiérarchisés (parentId, likes, pinned, CommentLike)"`

---

### Task 2: Backend — commentaires threadés + réponses (service + POST/GET)

**Files:** Modify `apps/api/src/modules/designs/designs.service.ts`, `apps/api/src/modules/designs/designs.routes.ts` ; Create `apps/api/tests/comments-hierarchy.test.ts`.

**Interfaces:**
- `addComment(userId, designId, text, parentId?)` — valide parent racine du même design (sinon `ApiError 400`).
- `getThreadedComments(designId, viewerId)` → `ApiComment[]` (racines épinglé-d'abord/chrono + replies).
- `toApiComment` map (id, text, createdAt, user, likesCount, likedByMe, pinned, parentId, replies).

- [ ] **Step 1: Test (échec attendu)**

```typescript
// apps/api/tests/comments-hierarchy.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function design(tailorId: string) {
  return prisma.design.create({ data: { tailorId, title: 'M', category: 'ROBE', imageUrl: '/uploads/m.webp', imageWidth: 600, imageHeight: 800 } });
}

describe('commentaires hierarchises', () => {
  let tailor: { token: string; user: { id: string } };
  let client: { token: string; user: { id: string } };
  let designId: string;
  beforeEach(async () => {
    tailor = await registerUser(app, 'TAILLEUR', '+221770009001');
    client = await registerUser(app, 'CLIENT', '+221770009002');
    designId = (await design(tailor.user.id)).id;
  });

  async function comment(token: string, text: string, parentId?: string) {
    return request(app).post(`/designs/${designId}/comments`).set('Authorization', `Bearer ${token}`).send({ text, parentId });
  }

  it('cree une reponse rattachee au parent', async () => {
    const root = await comment(client.token, 'Racine');
    const reply = await comment(tailor.token, 'Reponse', root.body.comment.id);
    expect(reply.status).toBe(201);
    const list = await request(app).get(`/designs/${designId}/comments`);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].replies).toHaveLength(1);
    expect(list.body.comments[0].replies[0].text).toBe('Reponse');
  });

  it('like idempotent + likedByMe', async () => {
    const c = await comment(client.token, 'Joli');
    const id = c.body.comment.id;
    await request(app).post(`/comments/${id}/like`).set('Authorization', `Bearer ${tailor.token}`);
    await request(app).post(`/comments/${id}/like`).set('Authorization', `Bearer ${tailor.token}`);
    const list = await request(app).get(`/designs/${designId}/comments`).set('Authorization', `Bearer ${tailor.token}`);
    expect(list.body.comments[0].likesCount).toBe(1);
    expect(list.body.comments[0].likedByMe).toBe(true);
  });

  it('supprime uniquement par l auteur (404 sinon) + compteur', async () => {
    const c = await comment(client.token, 'A supprimer');
    const other = await request(app).delete(`/comments/${c.body.comment.id}`).set('Authorization', `Bearer ${tailor.token}`);
    expect(other.status).toBe(404);
    const mine = await request(app).delete(`/comments/${c.body.comment.id}`).set('Authorization', `Bearer ${client.token}`);
    expect(mine.status).toBe(204);
    const d = await prisma.design.findUnique({ where: { id: designId } });
    expect(d!.commentsCount).toBe(0);
  });

  it('epingle par le tailleur seulement, epingle unique, en tete', async () => {
    const c1 = await comment(client.token, 'Un');
    const c2 = await comment(client.token, 'Deux');
    const bad = await request(app).patch(`/comments/${c1.body.comment.id}/pin`).set('Authorization', `Bearer ${client.token}`).send({ pinned: true });
    expect(bad.status).toBe(404);
    await request(app).patch(`/comments/${c1.body.comment.id}/pin`).set('Authorization', `Bearer ${tailor.token}`).send({ pinned: true });
    await request(app).patch(`/comments/${c2.body.comment.id}/pin`).set('Authorization', `Bearer ${tailor.token}`).send({ pinned: true });
    const list = await request(app).get(`/designs/${designId}/comments`);
    expect(list.body.comments[0].id).toBe(c2.body.comment.id);
    expect(list.body.comments.filter((x: { pinned: boolean }) => x.pinned)).toHaveLength(1);
  });
});
```

Run (échec attendu) : `cd apps/api && PATH=…node20… npx dotenv -e .env.test -- prisma migrate deploy && PATH=…node20… npx vitest run tests/comments-hierarchy.test.ts`

- [ ] **Step 2: Service (`designs.service.ts`)**

Remplacer `addComment` et ajouter `getThreadedComments` + `toApiComment` :

```typescript
export function toApiComment(c: {
  id: string; text: string; createdAt: Date; parentId: string | null; pinned: boolean; likesCount: number;
  user: { id: string; name: string; avatarUrl: string | null };
  likes?: { id: string }[];
  replies?: Parameters<typeof toApiComment>[0][];
}) {
  return {
    id: c.id, text: c.text, createdAt: c.createdAt, parentId: c.parentId,
    pinned: c.pinned, likesCount: c.likesCount, likedByMe: (c.likes?.length ?? 0) > 0,
    user: c.user,
    replies: (c.replies ?? []).map(toApiComment),
  };
}

export async function addComment(userId: string, designId: string, text: string, parentId?: string) {
  await ensureDesignExists(designId);
  if (parentId) {
    const parent = await prisma.comment.findFirst({ where: { id: parentId, designId } });
    if (!parent || parent.parentId) {
      throw new ApiError(400, 'REPONSE_INVALIDE', 'Réponse invalide.');
    }
  }
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { userId, designId, text, parentId: parentId ?? null },
      include: { user: { select: publicUserSelect }, likes: { where: { userId }, select: { id: true } } },
    }),
    prisma.design.update({ where: { id: designId }, data: { commentsCount: { increment: 1 } } }),
  ]);
  return toApiComment({ ...comment, replies: [] });
}

export async function getThreadedComments(designId: string, viewerId: string) {
  const roots = await prisma.comment.findMany({
    where: { designId, parentId: null },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'asc' }],
    take: 200,
    include: {
      user: { select: publicUserSelect },
      likes: { where: { userId: viewerId }, select: { id: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: publicUserSelect }, likes: { where: { userId: viewerId }, select: { id: true } } },
      },
    },
  });
  return roots.map((r) => toApiComment(r));
}
```

- [ ] **Step 3: Routes (`designs.routes.ts`)**

`commentSchema` accepte `parentId` :

```typescript
const commentSchema = z.object({
  text: z.string().min(1, 'Le commentaire ne peut pas être vide.').max(500),
  parentId: z.string().optional(),
});
```

POST : passer `parsed.data.parentId` à `addComment`. GET `/:id/comments` : renvoyer
`{ comments: await getThreadedComments(id, viewerId) }` (viewer = `req.user?.sub ?? ''`),
avec `optionalAuth`. (Importer `getThreadedComments` ; ajouter `optionalAuth` sur la route GET.)

```typescript
designsRouter.post('/:id/comments', requireAuth, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  const comment = await addComment(req.user!.sub, req.params.id as string, parsed.data.text, parsed.data.parentId);
  res.status(201).json({ comment });
});

designsRouter.get('/:id/comments', optionalAuth, async (req, res) => {
  await ensureDesignExists(req.params.id as string);
  res.json({ comments: await getThreadedComments(req.params.id as string, req.user?.sub ?? '') });
});
```

- [ ] **Step 4: Lancer les tests de réponse/GET (les tests like/delete/pin échouent encore → Task 3)**

Run: `PATH=…node20… npx vitest run tests/comments-hierarchy.test.ts` — le test « cree une reponse » passe ; les autres attendent Task 3.

- [ ] **Step 5: Commit** — `git add apps/api/src/modules/designs && git commit -m "feat(api): commentaires threadés + réponses"`

---

### Task 3: Backend — like / delete / pin (module comments)

**Files:** Create `apps/api/src/modules/comments/comments.service.ts`, `comments.routes.ts` ; Modify `apps/api/src/app.ts`.

**Interfaces:** routes `/comments` : `POST /:id/like`, `DELETE /:id/like`, `DELETE /:id`, `PATCH /:id/pin`.

- [ ] **Step 1: Service**

```typescript
// apps/api/src/modules/comments/comments.service.ts
import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

async function getComment(commentId: string) {
  const c = await prisma.comment.findUnique({ where: { id: commentId }, include: { design: { select: { tailorId: true, id: true } } } });
  if (!c) throw new ApiError(404, 'INTROUVABLE', 'Commentaire introuvable.');
  return c;
}

export async function likeComment(userId: string, commentId: string) {
  await getComment(commentId);
  try {
    await prisma.$transaction([
      prisma.commentLike.create({ data: { userId, commentId } }),
      prisma.comment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 } } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    throw err;
  }
}

export async function unlikeComment(userId: string, commentId: string) {
  const deleted = await prisma.commentLike.deleteMany({ where: { userId, commentId } });
  if (deleted.count > 0) {
    await prisma.comment.update({ where: { id: commentId }, data: { likesCount: { decrement: 1 } } });
  }
}

export async function deleteComment(userId: string, commentId: string) {
  const c = await getComment(commentId);
  if (c.userId !== userId) throw new ApiError(404, 'INTROUVABLE', 'Commentaire introuvable.');
  const replies = await prisma.comment.count({ where: { parentId: commentId } });
  await prisma.$transaction([
    prisma.comment.delete({ where: { id: commentId } }),
    prisma.design.update({ where: { id: c.designId }, data: { commentsCount: { decrement: 1 + replies } } }),
  ]);
}

export async function pinComment(userId: string, commentId: string, pinned: boolean) {
  const c = await getComment(commentId);
  if (c.design.tailorId !== userId) throw new ApiError(404, 'INTROUVABLE', 'Commentaire introuvable.');
  if (pinned) {
    await prisma.comment.updateMany({ where: { designId: c.designId, pinned: true }, data: { pinned: false } });
  }
  await prisma.comment.update({ where: { id: commentId }, data: { pinned } });
}
```

- [ ] **Step 2: Routes + montage**

```typescript
// apps/api/src/modules/comments/comments.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { deleteComment, likeComment, pinComment, unlikeComment } from './comments.service.js';

export const commentsRouter = Router();

commentsRouter.post('/:id/like', requireAuth, async (req, res) => {
  await likeComment(req.user!.sub, req.params.id as string);
  res.status(204).send();
});
commentsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  await unlikeComment(req.user!.sub, req.params.id as string);
  res.status(204).send();
});
commentsRouter.delete('/:id', requireAuth, async (req, res) => {
  await deleteComment(req.user!.sub, req.params.id as string);
  res.status(204).send();
});
commentsRouter.patch('/:id/pin', requireAuth, async (req, res) => {
  const parsed = z.object({ pinned: z.boolean() }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'DONNEES_INVALIDES', 'Valeur invalide.');
  await pinComment(req.user!.sub, req.params.id as string, parsed.data.pinned);
  res.status(204).send();
});
```

Dans `apps/api/src/app.ts` : `import { commentsRouter } from './modules/comments/comments.routes.js';` puis `app.use('/comments', commentsRouter);`.

- [ ] **Step 3: Vert + non-régression** — `PATH=…node20… npx vitest run tests/comments-hierarchy.test.ts` (4 tests verts) ; `PATH=…node20… npx tsc --noEmit && PATH=…node20… npm test`.

- [ ] **Step 4: Commit** — `git add apps/api/src/modules/comments apps/api/src/app.ts && git commit -m "feat(api): like / suppression / épingle de commentaire"`

---

### Task 4: Mobile — type `ApiComment` + hook `useComments`

**Files:** Modify `apps/mobile/src/types.ts` ; Create `apps/mobile/src/design/useComments.ts`.

- [ ] **Step 1: Type**

```typescript
export type ApiComment = {
  id: string;
  text: string;
  createdAt: string;
  parentId: string | null;
  pinned: boolean;
  likesCount: number;
  likedByMe: boolean;
  user: ApiUser;
  replies: ApiComment[];
};
```

- [ ] **Step 2: Hook**

```typescript
// apps/mobile/src/design/useComments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import type { ApiComment } from '../types';

export function useComments(designId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['comments', designId] });
    qc.invalidateQueries({ queryKey: ['design', designId] });
  };
  const q = useQuery({
    queryKey: ['comments', designId],
    queryFn: () => apiFetch<{ comments: ApiComment[] }>(`/designs/${designId}/comments`, { token }),
  });
  const post = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId?: string }) =>
      apiFetch(`/designs/${designId}/comments`, { method: 'POST', body: { text, parentId }, token }),
    onSuccess: invalidate,
  });
  const like = useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      apiFetch(`/comments/${commentId}/like`, { method: liked ? 'DELETE' : 'POST', token }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => apiFetch(`/comments/${commentId}`, { method: 'DELETE', token }),
    onSuccess: invalidate,
  });
  const pin = useMutation({
    mutationFn: ({ commentId, pinned }: { commentId: string; pinned: boolean }) =>
      apiFetch(`/comments/${commentId}/pin`, { method: 'PATCH', body: { pinned }, token }),
    onSuccess: invalidate,
  });
  return {
    comments: q.data?.comments ?? [],
    isLoading: q.isLoading,
    post: (text: string, parentId?: string) => post.mutateAsync({ text, parentId }),
    toggleLike: (commentId: string, liked: boolean) => like.mutate({ commentId, liked }),
    remove: (commentId: string) => remove.mutate(commentId),
    togglePin: (commentId: string, pinned: boolean) => pin.mutate({ commentId, pinned }),
  };
}
```

- [ ] **Step 3: Typecheck + commit** — `cd apps/mobile && npx tsc --noEmit` ; `git add apps/mobile/src/types.ts apps/mobile/src/design/useComments.ts && git commit -m "feat(mobile): type ApiComment + hook useComments"`

---

### Task 5: Mobile — `CommentItem` (présentiel) + test

**Files:** Create `apps/mobile/src/design/CommentItem.tsx`, `apps/mobile/src/design/CommentItem.test.tsx`.

**Interfaces:** `CommentItem({ comment, viewerId, designTailorId, onLike, onReply, onDelete, onPin })`.

- [ ] **Step 1: Test (échec attendu)**

```tsx
// apps/mobile/src/design/CommentItem.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CommentItem } from './CommentItem';
import type { ApiComment } from '../types';

function c(over: Partial<ApiComment> = {}): ApiComment {
  return { id: 'c1', text: 'Joli', createdAt: '2026-08-12T00:00:00.000Z', parentId: null, pinned: false, likesCount: 2, likedByMe: false, user: { id: 'u1', name: 'Awa', avatarUrl: null }, replies: [], ...over };
}

const noop = { onLike: jest.fn(), onReply: jest.fn(), onDelete: jest.fn(), onPin: jest.fn() };

describe('CommentItem', () => {
  it('affiche texte, auteur, like et reponses', () => {
    render(<CommentItem comment={c({ replies: [c({ id: 'r1', text: 'Merci' })] })} viewerId="x" designTailorId="t" {...noop} />);
    expect(screen.getByText('Joli')).toBeTruthy();
    expect(screen.getByText('Awa')).toBeTruthy();
    expect(screen.getByText('Merci')).toBeTruthy();
    fireEvent.press(screen.getByTestId('comment-like-c1'));
    expect(noop.onLike).toHaveBeenCalledWith('c1', false);
  });

  it('montre Supprimer pour l auteur et Epingler pour le tailleur', () => {
    const props = { onLike: jest.fn(), onReply: jest.fn(), onDelete: jest.fn(), onPin: jest.fn() };
    render(<CommentItem comment={c({ user: { id: 'me', name: 'Moi', avatarUrl: null } })} viewerId="me" designTailorId="me" {...props} />);
    fireEvent.press(screen.getByTestId('comment-delete-c1'));
    expect(props.onDelete).toHaveBeenCalledWith('c1');
    fireEvent.press(screen.getByTestId('comment-pin-c1'));
    expect(props.onPin).toHaveBeenCalledWith('c1', true);
  });

  it('cache Supprimer/Epingler pour un tiers', () => {
    render(<CommentItem comment={c()} viewerId="autre" designTailorId="autre-tailleur" {...noop} />);
    expect(screen.queryByTestId('comment-delete-c1')).toBeNull();
    expect(screen.queryByTestId('comment-pin-c1')).toBeNull();
  });
});
```

- [ ] **Step 2: Implémenter `CommentItem`** (présentiel, tokens de thème)

Rendu : ligne auteur (avatar initiale + nom) + `badge « Épinglé »` si `pinned` ; texte ;
rangée d'actions : `comment-like-<id>` (Feather `heart`, accent si `likedByMe`, +
`likesCount`), `comment-reply-<id>` (« Répondre »), `comment-delete-<id>` (si
`comment.user.id === viewerId`), `comment-pin-<id>` (si `viewerId === designTailorId`
ET `parentId === null` — pin réservé aux racines ; label « Épingler »/« Désépingler »
selon `pinned`, appelle `onPin(id, !pinned)`). Réponses : `comment.replies.map` en
retrait (chaque réponse = un `CommentItem` avec `onReply` neutralisé si on veut limiter
la profondeur — ou masquer « Répondre » quand `parentId !== null`). `onLike(id,
likedByMe)`, `onReply(id, user.name)`.

- [ ] **Step 3: Vert + commit** — `npx jest src/design/CommentItem.test.tsx` (3) ; `git add apps/mobile/src/design/CommentItem.tsx apps/mobile/src/design/CommentItem.test.tsx && git commit -m "feat(mobile): CommentItem (like, réponses, actions rôle)"`

---

### Task 6: Mobile — `CommentsSheet` conteneur + `DesignScreen`

**Files:** Modify `apps/mobile/src/design/CommentsSheet.tsx`, `apps/mobile/src/design/CommentsSheet.test.tsx`, `apps/mobile/src/design/DesignScreen.tsx`.

- [ ] **Step 1: Réécrire `CommentsSheet` en conteneur**

Nouveaux props : `{ visible, onClose, designId, viewerId, designTailorId, authed, onRequireAuth }`.
Utilise `useComments(designId)`. Garde le patron bottom sheet (backdrop testID
`comments-backdrop`, poignée, titre « Commentaires »). Corps : liste de `CommentItem`
(`onLike`/`onReply`/`onDelete`/`onPin` câblés sur le hook ; `onReply(id, name)` fixe un
état `replyTo = { id, name }`). Bas : si `authed`, `TextInput` + envoyer → `post(text,
replyTo?.id)` puis reset ; si `replyTo`, afficher « Réponse à @nom » + croix pour
annuler. Si non `authed` : bouton « Connecte-toi pour commenter » → `onRequireAuth`.

- [ ] **Step 2: Mettre à jour `CommentsSheet.test.tsx`** (mock `useComments`)

```tsx
jest.mock('./useComments', () => ({
  useComments: () => ({
    comments: [{ id: 'c1', text: 'Trop beau', createdAt: '', parentId: null, pinned: false, likesCount: 0, likedByMe: false, user: { id: 'u1', name: 'Awa', avatarUrl: null }, replies: [] }],
    isLoading: false, post: jest.fn(), toggleLike: jest.fn(), remove: jest.fn(), togglePin: jest.fn(),
  }),
}));
```

Tests : visible → « Commentaires » + « Trop beau » ; backdrop → `onClose` ; non authed →
« Connecte-toi » et press → `onRequireAuth`. (Adapter les tests existants au nouveau
contrat de props.)

- [ ] **Step 3: `DesignScreen`** — passer les nouveaux props

Remplacer le rendu `<CommentsSheet …/>` par :

```tsx
      <CommentsSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        designId={id}
        viewerId={user?.id ?? ''}
        designTailorId={design.tailor.id}
        authed={authed}
        onRequireAuth={gate}
      />
```

Retirer l'usage de `actions.commentText/setCommentText/submitComment/commenting` pour le
sheet (le hook `useComments` gère). `useDesignActions` peut rester (like/bookmark).

- [ ] **Step 4: Typecheck + suite complète** — `cd apps/mobile && npx tsc --noEmit && npx jest`.

- [ ] **Step 5: Commit** — `git add apps/mobile/src/design/CommentsSheet.tsx apps/mobile/src/design/CommentsSheet.test.tsx apps/mobile/src/design/DesignScreen.tsx && git commit -m "feat(mobile): popup commentaires threadé (réponses, like, épingle, suppression)"`

---

### Task 7: Vérification finale

- [ ] **Step 1: Suites + typecheck** — API (`PATH=…node20… npm test`) + mobile (`npx jest`) verts.
- [ ] **Step 2: Bundle (Node 20)** — `PATH=…node20… npx expo export --platform ios --output-dir /tmp/moodly-m3` ; `.hbc` présent ; `rm -rf`.
- [ ] **Step 3: Revue manuelle** — ouvrir un modèle → popup commentaires : commenter, **répondre** (retrait), **liker** un commentaire, en tant que **tailleur propriétaire** épingler (remonte en tête), **supprimer** son propre commentaire.

## Notes d'implémentation

- Épingle **unique** par modèle (updateMany avant update). Pin **réservé aux racines**.
- Suppression décrémente `commentsCount` de `1 + réponses`.
- `likedByMe` calculé via `likes: { where: { userId: viewer } }` (vide si anonyme).
- Profondeur limitée à **un niveau** : une réponse ne montre pas « Répondre » imbriqué.
