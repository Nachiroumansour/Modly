import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

let clientToken: string;
let designId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770003001');
  const client = await registerUser(app, 'CLIENT', '+221770003002');
  clientToken = client.token;
  const design = await prisma.design.create({
    data: {
      tailorId: tailor.user.id,
      title: 'Ensemble wax',
      category: 'ENSEMBLE',
      imageUrl: 'http://localhost:3000/uploads/r.webp',
      imageWidth: 600,
      imageHeight: 800,
    },
  });
  designId = design.id;
});

async function like() {
  return request(app)
    .post(`/designs/${designId}/like`)
    .set('Authorization', `Bearer ${clientToken}`);
}

describe('likes', () => {
  it('like puis unlike : compteur et likedByMe cohérents', async () => {
    expect((await like()).status).toBe(204);
    let detail = await request(app)
      .get(`/designs/${designId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(detail.body.design.likesCount).toBe(1);
    expect(detail.body.design.likedByMe).toBe(true);

    const del = await request(app)
      .delete(`/designs/${designId}/like`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(del.status).toBe(204);
    detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.likesCount).toBe(0);
  });

  it('est idempotent : double like ne compte qu’une fois', async () => {
    await like();
    expect((await like()).status).toBe(204);
    const detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.likesCount).toBe(1);
  });

  it('est idempotent : unlike sans like préalable → 204, compteur à 0', async () => {
    const del = await request(app)
      .delete(`/designs/${designId}/like`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(del.status).toBe(204);
    const detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.likesCount).toBe(0);
  });

  it('refuse sans authentification (401)', async () => {
    const res = await request(app).post(`/designs/${designId}/like`);
    expect(res.status).toBe(401);
  });

  it('404 sur un modèle inconnu', async () => {
    const res = await request(app)
      .post('/designs/inexistant/like')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(404);
  });
});

describe('bookmarks', () => {
  it('sauvegarde puis liste dans GET /me/bookmarks', async () => {
    const add = await request(app)
      .post(`/designs/${designId}/bookmark`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(add.status).toBe(204);

    const list = await request(app)
      .get('/me/bookmarks')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(list.status).toBe(200);
    expect(list.body.designs).toHaveLength(1);
    expect(list.body.designs[0].id).toBe(designId);
    expect(list.body.designs[0].bookmarkedByMe).toBe(true);

    const detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.bookmarksCount).toBe(1);
  });

  it('retire la sauvegarde', async () => {
    await request(app)
      .post(`/designs/${designId}/bookmark`)
      .set('Authorization', `Bearer ${clientToken}`);
    await request(app)
      .delete(`/designs/${designId}/bookmark`)
      .set('Authorization', `Bearer ${clientToken}`);
    const list = await request(app)
      .get('/me/bookmarks')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(list.body.designs).toHaveLength(0);
  });
});
