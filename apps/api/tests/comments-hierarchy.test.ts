import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function design(tailorId: string) {
  return prisma.design.create({
    data: { tailorId, title: 'M', category: 'ROBE', imageUrl: '/uploads/m.webp', imageWidth: 600, imageHeight: 800 },
  });
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
