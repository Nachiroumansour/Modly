import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let clientToken: string;
let tailorToken: string;
let tailorId: string;
let designId: string;

beforeEach(async () => {
  const client = await registerUser(app, 'CLIENT', '+221770008001');
  const tailor = await registerUser(app, 'TAILLEUR', '+221770008002');
  clientToken = client.token;
  tailorToken = tailor.token;
  tailorId = tailor.user.id;
  const design = await prisma.design.create({
    data: {
      tailorId,
      title: 'Boubou de commande',
      category: 'BOUBOU',
      imageUrl: 'http://localhost:3000/uploads/o.webp',
      imageWidth: 600,
      imageHeight: 800,
    },
  });
  designId = design.id;
});

describe('POST /orders', () => {
  it('un client commande un modèle à un tailleur', async () => {
    const res = await request(app)
      .post('/orders')
      .set(auth(clientToken))
      .send({ tailorId, designId, note: 'Pour la Tabaski' });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('EN_ATTENTE');
    expect(res.body.order.paymentStatus).toBe('EN_ATTENTE');
    expect(res.body.order.designId).toBe(designId);
  });

  it('refuse un tailorId qui n’est pas un tailleur (400)', async () => {
    const autreClient = await registerUser(app, 'CLIENT', '+221770008003');
    const res = await request(app)
      .post('/orders')
      .set(auth(clientToken))
      .send({ tailorId: autreClient.user.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TAILLEUR_INVALIDE');
  });

  it('refuse un tailleur qui commande (403) et l’anonyme (401)', async () => {
    expect((await request(app).post('/orders').set(auth(tailorToken)).send({ tailorId })).status).toBe(403);
    expect((await request(app).post('/orders').send({ tailorId })).status).toBe(401);
  });
});

describe('GET /orders', () => {
  it('renvoie une vue différente selon le rôle', async () => {
    await request(app).post('/orders').set(auth(clientToken)).send({ tailorId, designId });

    const vueClient = await request(app).get('/orders').set(auth(clientToken));
    expect(vueClient.status).toBe(200);
    expect(vueClient.body.orders).toHaveLength(1);

    const vueTailleur = await request(app).get('/orders').set(auth(tailorToken));
    expect(vueTailleur.body.orders).toHaveLength(1);

    const autre = await registerUser(app, 'TAILLEUR', '+221770008004');
    const vueAutre = await request(app).get('/orders').set(auth(autre.token));
    expect(vueAutre.body.orders).toHaveLength(0);
  });
});

describe('GET /orders/:id', () => {
  it('le client et le tailleur voient le détail + la timeline', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId, designId });
    const id = created.body.order.id;

    const vueClient = await request(app).get(`/orders/${id}`).set(auth(clientToken));
    expect(vueClient.status).toBe(200);
    expect(vueClient.body.order.events).toHaveLength(1);
    expect(vueClient.body.order.events[0].status).toBe('EN_ATTENTE');
    expect(vueClient.body.order.tailor.name).toBeTruthy();

    expect((await request(app).get(`/orders/${id}`).set(auth(tailorToken))).status).toBe(200);
  });

  it('404 pour un tiers non concerné', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    const autre = await registerUser(app, 'CLIENT', '+221770008009');
    expect((await request(app).get(`/orders/${created.body.order.id}`).set(auth(autre.token))).status).toBe(404);
  });
});

describe('PATCH /orders/:id (tailleur)', () => {
  it('fixe le prix, le paiement et fige le snapshot des mesures via la fiche', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId, designId });
    const id = created.body.order.id;

    const rec = await request(app).post('/client-records').set(auth(tailorToken)).send({ name: 'Client cmd' });
    const recordId = rec.body.record.id;
    await request(app).post(`/client-records/${recordId}/measurements`).set(auth(tailorToken)).send({ tourPoitrine: 100 });

    const res = await request(app)
      .patch(`/orders/${id}`)
      .set(auth(tailorToken))
      .send({ agreedPrice: 25000, paymentStatus: 'ACOMPTE', clientRecordId: recordId });
    expect(res.status).toBe(200);
    expect(res.body.order.agreedPrice).toBe(25000);
    expect(res.body.order.paymentStatus).toBe('ACOMPTE');
    expect(res.body.order.measurementsSnapshot.tourPoitrine).toBe(100);
  });

  it('refuse le client (403) et la commande d’un autre tailleur (404)', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    const id = created.body.order.id;
    expect((await request(app).patch(`/orders/${id}`).set(auth(clientToken)).send({ agreedPrice: 1 })).status).toBe(403);
    const autre = await registerUser(app, 'TAILLEUR', '+221770008010');
    expect((await request(app).patch(`/orders/${id}`).set(auth(autre.token)).send({ agreedPrice: 1 })).status).toBe(404);
  });

  it('refuse un corps vide (400)', async () => {
    const created = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    expect((await request(app).patch(`/orders/${created.body.order.id}`).set(auth(tailorToken)).send({})).status).toBe(400);
  });
});

describe('PATCH /orders/:id/status (machine à états)', () => {
  async function newOrder() {
    const c = await request(app).post('/orders').set(auth(clientToken)).send({ tailorId });
    return c.body.order.id as string;
  }

  it('avance dans la chaîne et enregistre la timeline', async () => {
    const id = await newOrder();
    expect((await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'TISSU_RECU' })).status).toBe(200);
    const r2 = await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'COUPE', note: 'Découpe faite' });
    expect(r2.status).toBe(200);
    expect(r2.body.order.status).toBe('COUPE');

    const detail = await request(app).get(`/orders/${id}`).set(auth(clientToken));
    // EN_ATTENTE (création) + TISSU_RECU + COUPE
    expect(detail.body.order.events).toHaveLength(3);
  });

  it('refuse un recul (409)', async () => {
    const id = await newOrder();
    await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'COUPE' });
    const back = await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'TISSU_RECU' });
    expect(back.status).toBe(409);
    expect(back.body.error.code).toBe('TRANSITION_INVALIDE');
  });

  it('permet d’annuler puis refuse toute transition ensuite', async () => {
    const id = await newOrder();
    expect((await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'ANNULEE' })).status).toBe(200);
    expect((await request(app).patch(`/orders/${id}/status`).set(auth(tailorToken)).send({ status: 'COUPE' })).status).toBe(409);
  });

  it('refuse un client (403)', async () => {
    const id = await newOrder();
    expect((await request(app).patch(`/orders/${id}/status`).set(auth(clientToken)).send({ status: 'COUPE' })).status).toBe(403);
  });
});
