import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

async function publish(token: string, title: string) {
  const res = await request(app)
    .post('/designs')
    .set('Authorization', `Bearer ${token}`)
    .field('title', title)
    .field('category', 'BOUBOU')
    .attach('media', await makeTestImage(), 'm.jpg');
  return res.body.design.id as string;
}

describe('GET /tailors/:id — enrichissement M6', () => {
  it('renvoie likesTotal = somme des likes de ses modèles', async () => {
    const { token: tailor, user } = await registerUser(app, 'TAILLEUR', '+221770003001');
    const d1 = await publish(tailor, 'A');
    const d2 = await publish(tailor, 'B');
    const { token: client } = await registerUser(app, 'CLIENT', '+221770003002');
    await request(app).post(`/designs/${d1}/like`).set('Authorization', `Bearer ${client}`);
    await request(app).post(`/designs/${d2}/like`).set('Authorization', `Bearer ${client}`);

    const res = await request(app).get(`/tailors/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tailor.likesTotal).toBe(2);
  });

  it('coverUrl est null par défaut dans le profil', async () => {
    const { token: tailor, user } = await registerUser(app, 'TAILLEUR', '+221770003003');
    await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${tailor}`)
      .send({ bio: 'Bazin riche' });
    const res = await request(app).get(`/tailors/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tailor.profile.coverUrl).toBeNull();
  });
});
