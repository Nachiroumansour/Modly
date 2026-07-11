import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

let tailorToken: string;
let tailorId: string;
let clientToken: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770005001');
  const client = await registerUser(app, 'CLIENT', '+221770005002');
  tailorToken = tailor.token;
  tailorId = tailor.user.id;
  clientToken = client.token;
});

describe('follows', () => {
  it('suit puis ne suit plus un tailleur (idempotent)', async () => {
    const follow = () =>
      request(app)
        .post(`/tailors/${tailorId}/follow`)
        .set('Authorization', `Bearer ${clientToken}`);
    expect((await follow()).status).toBe(204);
    expect((await follow()).status).toBe(204);
    expect(await prisma.follow.count()).toBe(1);

    const profile = await request(app)
      .get(`/tailors/${tailorId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(profile.body.tailor.followersCount).toBe(1);
    expect(profile.body.followedByMe).toBe(true);

    const unfollow = await request(app)
      .delete(`/tailors/${tailorId}/follow`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(unfollow.status).toBe(204);
    expect(await prisma.follow.count()).toBe(0);
  });

  it('refuse de se suivre soi-même (400)', async () => {
    const res = await request(app)
      .post(`/tailors/${tailorId}/follow`)
      .set('Authorization', `Bearer ${tailorToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ACTION_INVALIDE');
  });

  it('404 si la cible n’est pas un tailleur', async () => {
    const autreClient = await registerUser(app, 'CLIENT', '+221770005003');
    const res = await request(app)
      .post(`/tailors/${autreClient.user.id}/follow`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /tailors/:id', () => {
  it('renvoie le profil public sans authentification, sans téléphone', async () => {
    await prisma.design.create({
      data: {
        tailorId,
        title: 'Boubou du profil',
        category: 'BOUBOU',
        imageUrl: 'http://localhost:3000/uploads/p.webp',
        imageWidth: 600,
        imageHeight: 800,
      },
    });
    const res = await request(app).get(`/tailors/${tailorId}`);
    expect(res.status).toBe(200);
    expect(res.body.tailor.name).toBe('Mamadou');
    expect(res.body.tailor.phone).toBeUndefined();
    expect(res.body.tailor.designsCount).toBe(1);
    expect(res.body.tailor.profile.verified).toBe(false);
    expect(res.body.designs).toHaveLength(1);
    expect(res.body.followedByMe).toBe(false);
  });

  it('404 pour un client ou un id inconnu', async () => {
    const client = await registerUser(app, 'CLIENT', '+221770005004');
    expect((await request(app).get(`/tailors/${client.user.id}`)).status).toBe(404);
    expect((await request(app).get('/tailors/inexistant')).status).toBe(404);
  });
});

describe('PATCH /me/profile', () => {
  it('met à jour le profil du tailleur', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${tailorToken}`)
      .send({
        bio: 'Tailleur depuis 12 ans au marché HLM',
        location: 'Dakar — HLM',
        specialties: ['boubou', 'mariage'],
        yearsExperience: 12,
        priceMin: 5000,
        priceMax: 50000,
      });
    expect(res.status).toBe(200);
    expect(res.body.profile.location).toBe('Dakar — HLM');
    expect(res.body.profile.specialties).toEqual(['boubou', 'mariage']);
  });

  it('refuse un client (403)', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ bio: 'x' });
    expect(res.status).toBe(403);
  });

  it('refuse priceMin > priceMax (400)', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${tailorToken}`)
      .send({ priceMin: 9000, priceMax: 100 });
    expect(res.status).toBe(400);
  });

  it('refuse un corps vide (400)', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${tailorToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
