import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();

describe('/me/self-measurement', () => {
  let clientToken: string;

  beforeEach(async () => {
    const c = await registerUser(app, 'CLIENT', '+221770006001');
    clientToken = c.token;
  });

  it('cree puis lit les mesures personnelles du client', async () => {
    const put = await request(app)
      .put('/me/self-measurement')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tourPoitrine: 95, tourTaille: 80 });
    expect(put.status).toBe(200);
    expect(put.body.measurement.tourPoitrine).toBe(95);

    const get = await request(app)
      .get('/me/self-measurement')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(get.status).toBe(200);
    expect(get.body.measurement.tourTaille).toBe(80);
  });

  it('met a jour en place (upsert, une seule ligne)', async () => {
    await request(app)
      .put('/me/self-measurement')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tourPoitrine: 95 });
    const put2 = await request(app)
      .put('/me/self-measurement')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tourPoitrine: 100 });
    expect(put2.body.measurement.tourPoitrine).toBe(100);

    const get = await request(app)
      .get('/me/self-measurement')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(get.body.measurement.tourPoitrine).toBe(100);
  });

  it('renvoie null quand aucune mesure', async () => {
    const c = await registerUser(app, 'CLIENT', '+221770006099');
    const get = await request(app).get('/me/self-measurement').set('Authorization', `Bearer ${c.token}`);
    expect(get.status).toBe(200);
    expect(get.body.measurement).toBeNull();
  });

  it('refuse une valeur hors bornes (400)', async () => {
    const res = await request(app)
      .put('/me/self-measurement')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tourPoitrine: 400 });
    expect(res.status).toBe(400);
  });

  it('refuse un corps vide (400)', async () => {
    const res = await request(app)
      .put('/me/self-measurement')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('refuse un tailleur (403)', async () => {
    const t = await registerUser(app, 'TAILLEUR', '+221770006002');
    const res = await request(app)
      .put('/me/self-measurement')
      .set('Authorization', `Bearer ${t.token}`)
      .send({ tourPoitrine: 95 });
    expect(res.status).toBe(403);
  });
});
