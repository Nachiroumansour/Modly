import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/lib/errors.js';
import { requireAuth, requireRole } from '../src/middleware/auth.js';

const app = createApp();

async function registerAndGetToken(role: 'TAILLEUR' | 'CLIENT', phone: string) {
  const res = await request(app).post('/auth/register').send({
    phone,
    password: 'secret123',
    name: role === 'TAILLEUR' ? 'Mamadou' : 'Fatou',
    role,
  });
  return res.body.accessToken as string;
}

describe('GET /me', () => {
  it('refuse sans token (401)', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NON_AUTHENTIFIE');
  });

  it('refuse un token invalide (401)', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer bidon');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDE');
  });

  it('renvoie le profil du tailleur connecté avec son tailorProfile', async () => {
    const token = await registerAndGetToken('TAILLEUR', '+221770000010');
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Mamadou');
    expect(res.body.user.tailorProfile).not.toBeNull();
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});

describe('requireRole', () => {
  function miniApp() {
    const mini = express();
    mini.get('/tailleurs-seulement', requireAuth, requireRole('TAILLEUR'), (_req, res) => {
      res.json({ ok: true });
    });
    mini.use(errorHandler);
    return mini;
  }

  it('bloque un client sur une route tailleur (403)', async () => {
    const token = await registerAndGetToken('CLIENT', '+221770000011');
    const res = await request(miniApp())
      .get('/tailleurs-seulement')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCES_REFUSE');
  });

  it('laisse passer un tailleur', async () => {
    const token = await registerAndGetToken('TAILLEUR', '+221770000012');
    const res = await request(miniApp())
      .get('/tailleurs-seulement')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
