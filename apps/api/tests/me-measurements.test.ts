import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let tailorToken: string;
let clientToken: string;
let clientId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770010001');
  const client = await registerUser(app, 'CLIENT', '+221770010002');
  tailorToken = tailor.token;
  clientToken = client.token;
  clientId = client.user.id;
});

describe('GET /me/measurements (client)', () => {
  it('renvoie les mesures des fiches liées au compte client', async () => {
    const rec = await request(app)
      .post('/client-records')
      .set(auth(tailorToken))
      .send({ name: 'Compte lié', userId: clientId });
    await request(app)
      .post(`/client-records/${rec.body.record.id}/measurements`)
      .set(auth(tailorToken))
      .send({ tourPoitrine: 96, tourTaille: 80 });

    const res = await request(app).get('/me/measurements').set(auth(clientToken));
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0].tailor.name).toBe('Mamadou');
    expect(res.body.records[0].latestMeasurement.tourPoitrine).toBe(96);
  });

  it('ne renvoie rien pour un client sans fiche liée', async () => {
    const res = await request(app).get('/me/measurements').set(auth(clientToken));
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(0);
  });

  it('refuse un tailleur (403)', async () => {
    const res = await request(app).get('/me/measurements').set(auth(tailorToken));
    expect(res.status).toBe(403);
  });
});
