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

  it("persiste les centres d'intérêt fournis à l'inscription", async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...fatou, phone: '+221770000010', interests: ['MARIAGE', 'ROBE', 'BOUBOU'] });
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { id: res.body.user.id } });
    expect(user?.interests).toEqual(['MARIAGE', 'ROBE', 'BOUBOU']);
  });

  it("refuse une catégorie d'intérêt invalide (400)", async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...fatou, phone: '+221770000011', interests: ['PAS_UNE_CATEGORIE'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
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

describe('POST /auth/login', () => {
  it('connecte un utilisateur inscrit', async () => {
    await request(app).post('/auth/register').send(fatou);
    const res = await request(app)
      .post('/auth/login')
      .send({ phone: fatou.phone, password: fatou.password });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Fatou');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('refuse un mauvais mot de passe (401)', async () => {
    await request(app).post('/auth/register').send(fatou);
    const res = await request(app)
      .post('/auth/login')
      .send({ phone: fatou.phone, password: 'mauvais-mdp' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('IDENTIFIANTS_INVALIDES');
  });

  it('refuse un numéro inconnu (401)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ phone: '+221779999999', password: 'nimporte' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('IDENTIFIANTS_INVALIDES');
  });
});

describe('POST /auth/refresh', () => {
  it('délivre un nouvel access token', async () => {
    const reg = await request(app).post('/auth/register').send(fatou);
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('refuse un refresh token invalide (401)', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'token-bidon' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDE');
  });
});
