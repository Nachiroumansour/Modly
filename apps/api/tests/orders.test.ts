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
