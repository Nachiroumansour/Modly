import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let tailor: Awaited<ReturnType<typeof registerUser>>;
let client: Awaited<ReturnType<typeof registerUser>>;
let designId: string;

beforeEach(async () => {
  tailor = await registerUser(app, 'TAILLEUR', '+221770012001');
  client = await registerUser(app, 'CLIENT', '+221770012002');
  const design = await prisma.design.create({
    data: { tailorId: tailor.user.id, title: 'B', category: 'BOUBOU', imageUrl: 'http://x/o.webp', imageWidth: 600, imageHeight: 800 },
  });
  designId = design.id;
});

describe('déclencheurs sociaux', () => {
  it('un like notifie le tailleur propriétaire', async () => {
    await request(app).post(`/designs/${designId}/like`).set(auth(client.token));
    const n = await prisma.notification.findMany({ where: { recipientId: tailor.user.id, type: 'LIKE' } });
    expect(n).toHaveLength(1);
    expect(n[0].lastActorId).toBe(client.user.id);
  });

  it('un commentaire notifie le tailleur', async () => {
    await request(app).post(`/designs/${designId}/comments`).set(auth(client.token)).send({ text: 'Superbe' });
    expect(await prisma.notification.count({ where: { recipientId: tailor.user.id, type: 'COMMENT' } })).toBe(1);
  });

  it('une réponse notifie l’auteur du commentaire parent', async () => {
    const c = await request(app).post(`/designs/${designId}/comments`).set(auth(client.token)).send({ text: 'Q' });
    await request(app).post(`/designs/${designId}/comments`).set(auth(tailor.token)).send({ text: 'R', parentId: c.body.comment.id });
    expect(await prisma.notification.count({ where: { recipientId: client.user.id, type: 'REPLY' } })).toBe(1);
  });

  it('un follow notifie le tailleur', async () => {
    await request(app).post(`/tailors/${tailor.user.id}/follow`).set(auth(client.token));
    expect(await prisma.notification.count({ where: { recipientId: tailor.user.id, type: 'FOLLOW' } })).toBe(1);
  });

  it('liker son propre modèle ne crée pas de notif', async () => {
    // le tailleur like son modèle
    await request(app).post(`/designs/${designId}/like`).set(auth(tailor.token));
    expect(await prisma.notification.count({ where: { recipientId: tailor.user.id } })).toBe(0);
  });
});

describe('déclencheurs commande', () => {
  it('une nouvelle commande notifie le tailleur', async () => {
    await request(app).post('/orders').set(auth(client.token)).send({ tailorId: tailor.user.id, designId });
    const n = await prisma.notification.findMany({ where: { recipientId: tailor.user.id, type: 'ORDER' } });
    expect(n).toHaveLength(1);
    expect(n[0].lastActorId).toBe(client.user.id);
  });

  it('un changement de statut notifie le client', async () => {
    const created = await request(app).post('/orders').set(auth(client.token)).send({ tailorId: tailor.user.id, designId });
    const orderId = created.body.order.id;
    await request(app).patch(`/orders/${orderId}/status`).set(auth(tailor.token)).send({ status: 'TISSU_RECU' });
    const n = await prisma.notification.findMany({ where: { recipientId: client.user.id, type: 'ORDER' } });
    expect(n.length).toBeGreaterThanOrEqual(1);
    expect(n.some((x) => x.orderId === orderId)).toBe(true);
  });
});
