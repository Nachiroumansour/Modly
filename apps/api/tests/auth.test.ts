import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

const fatou = {
  phone: '+221771234567',
  password: 'secret123',
  name: 'Fatou',
  role: 'CLIENT',
};

describe('POST /auth/register', () => {
  it('inscrit un client et renvoie les tokens', async () => {
    const res = await request(app).post('/auth/register').send(fatou);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      phone: '+221771234567',
      name: 'Fatou',
      role: 'CLIENT',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("crée automatiquement le profil tailleur à l'inscription d'un tailleur", async () => {
    const res = await request(app).post('/auth/register').send({
      phone: '+221770000002',
      password: 'secret123',
      name: 'Mamadou',
      role: 'TAILLEUR',
    });
    expect(res.status).toBe(201);
    const profile = await prisma.tailorProfile.findUnique({
      where: { userId: res.body.user.id },
    });
    expect(profile).not.toBeNull();
    expect(profile?.verified).toBe(false);
  });

  it('refuse un téléphone déjà inscrit (409)', async () => {
    await request(app).post('/auth/register').send(fatou);
    const res = await request(app).post('/auth/register').send(fatou);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TELEPHONE_DEJA_UTILISE');
  });

  it('refuse un mot de passe trop court (400)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...fatou, password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });

  it('refuse un téléphone mal formé (400)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...fatou, phone: 'pas-un-numero' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });
});
