import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let tailorToken: string;
let recordId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770007001');
  tailorToken = tailor.token;
  const rec = await request(app)
    .post('/client-records')
    .set(auth(tailorToken))
    .send({ name: 'Client mesuré' });
  recordId = rec.body.record.id;
});

describe('mesures versionnées', () => {
  it('enregistre deux versions et renvoie l’historique antéchronologique', async () => {
    const v1 = await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken))
      .send({ tourPoitrine: 96, tourTaille: 80 });
    expect(v1.status).toBe(201);
    expect(v1.body.measurement.tourPoitrine).toBe(96);
    expect(v1.body.measurement.source).toBe('MANUELLE');

    await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken))
      .send({ tourPoitrine: 98, longueurBoubou: 145 });

    const hist = await request(app)
      .get(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken));
    expect(hist.status).toBe(200);
    expect(hist.body.measurements).toHaveLength(2);
    expect(hist.body.measurements[0].tourPoitrine).toBe(98); // plus récent d'abord

    const detail = await request(app).get(`/client-records/${recordId}`).set(auth(tailorToken));
    expect(detail.body.latestMeasurement.tourPoitrine).toBe(98);
  });

  it('refuse une version sans aucune mesure (400)', async () => {
    const res = await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken))
      .send({ source: 'MANUELLE' });
    expect(res.status).toBe(400);
  });

  it('refuse une valeur hors bornes (400)', async () => {
    const res = await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(tailorToken))
      .send({ tourTaille: 999 });
    expect(res.status).toBe(400);
  });

  it('404 si la fiche n’est pas au tailleur', async () => {
    const autre = await registerUser(app, 'TAILLEUR', '+221770007002');
    const res = await request(app)
      .post(`/client-records/${recordId}/measurements`)
      .set(auth(autre.token))
      .send({ tourTaille: 80 });
    expect(res.status).toBe(404);
  });
});
