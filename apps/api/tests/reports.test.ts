import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

async function publish(token: string) {
  const res = await request(app)
    .post('/designs')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'A')
    .field('category', 'BOUBOU')
    .attach('media', await makeTestImage(), 'm.jpg');
  return res.body.design.id as string;
}

describe('POST /reports (M5)', () => {
  it('signale un modèle (201)', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770006001');
    const designId = await publish(tailor);
    const { token: client } = await registerUser(app, 'CLIENT', '+221770006002');
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${client}`)
      .send({ targetType: 'DESIGN', targetId: designId, reason: 'INAPPROPRIE' });
    expect(res.status).toBe(201);
    expect(res.body.report.status).toBe('OPEN');
  });

  it('signale un utilisateur (201) mais refuse soi-même (400)', async () => {
    const { token, user } = await registerUser(app, 'CLIENT', '+221770006003');
    const { user: other } = await registerUser(app, 'TAILLEUR', '+221770006004');
    const ok = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'USER', targetId: other.id, reason: 'HARCELEMENT' });
    expect(ok.status).toBe(201);
    const self = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'USER', targetId: user.id, reason: 'SPAM' });
    expect(self.status).toBe(400);
  });

  it('idempotent : 2ᵉ signalement identique → 200', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770006005');
    const designId = await publish(tailor);
    const { token: client } = await registerUser(app, 'CLIENT', '+221770006006');
    const body = { targetType: 'DESIGN', targetId: designId, reason: 'SPAM' };
    await request(app).post('/reports').set('Authorization', `Bearer ${client}`).send(body);
    const dup = await request(app).post('/reports').set('Authorization', `Bearer ${client}`).send(body);
    expect(dup.status).toBe(200);
    expect(dup.body.alreadyReported).toBe(true);
  });

  it('404 si la cible n’existe pas', async () => {
    const { token } = await registerUser(app, 'CLIENT', '+221770006007');
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'DESIGN', targetId: 'inexistant', reason: 'AUTRE' });
    expect(res.status).toBe(404);
  });

  it('400 si reason invalide', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770006008');
    const designId = await publish(tailor);
    const { token } = await registerUser(app, 'CLIENT', '+221770006009');
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'DESIGN', targetId: designId, reason: 'PAS_UNE_RAISON' });
    expect(res.status).toBe(400);
  });
});
