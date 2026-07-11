import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

let clientToken: string;
let designId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770004001');
  const client = await registerUser(app, 'CLIENT', '+221770004002');
  clientToken = client.token;
  const design = await prisma.design.create({
    data: {
      tailorId: tailor.user.id,
      title: 'Robe de mariée',
      category: 'MARIAGE',
      imageUrl: 'http://localhost:3000/uploads/c.webp',
      imageWidth: 600,
      imageHeight: 800,
    },
  });
  designId = design.id;
});

describe('commentaires', () => {
  it('commente puis liste (ordre chronologique) et incrémente le compteur', async () => {
    const post = await request(app)
      .post(`/designs/${designId}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'Magnifique, je veux le même !' });
    expect(post.status).toBe(201);
    expect(post.body.comment.text).toBe('Magnifique, je veux le même !');
    expect(post.body.comment.user.name).toBe('Fatou');

    await request(app)
      .post(`/designs/${designId}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'Quel tissu ?' });

    const list = await request(app).get(`/designs/${designId}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.comments).toHaveLength(2);
    expect(list.body.comments[0].text).toBe('Magnifique, je veux le même !');

    const detail = await request(app).get(`/designs/${designId}`);
    expect(detail.body.design.commentsCount).toBe(2);
  });

  it('refuse un commentaire vide (400)', async () => {
    const res = await request(app)
      .post(`/designs/${designId}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });

  it('refuse sans authentification (401)', async () => {
    const res = await request(app)
      .post(`/designs/${designId}/comments`)
      .send({ text: 'anonyme' });
    expect(res.status).toBe(401);
  });

  it('404 sur un modèle inconnu', async () => {
    const res = await request(app)
      .post('/designs/inexistant/comments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'perdu' });
    expect(res.status).toBe(404);
  });
});
