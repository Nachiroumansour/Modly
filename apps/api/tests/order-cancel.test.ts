import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let tailor: Awaited<ReturnType<typeof registerUser>>;
let client: Awaited<ReturnType<typeof registerUser>>;

async function makeOrder(status: string) {
  const created = await request(app).post('/orders').set(auth(client.token)).send({ tailorId: tailor.user.id });
  const id = created.body.order.id;
  if (status !== 'EN_ATTENTE') {
    // avancer via le tailleur jusqu'au statut voulu
    const chain = ['TISSU_RECU', 'COUPE'];
    for (const s of chain) {
      await request(app).patch(`/orders/${id}/status`).set(auth(tailor.token)).send({ status: s });
      if (s === status) break;
    }
  }
  return id;
}

beforeEach(async () => {
  tailor = await registerUser(app, 'TAILLEUR', '+221770013001');
  client = await registerUser(app, 'CLIENT', '+221770013002');
});

describe('PATCH /orders/:id/cancel (client)', () => {
  it('annule une commande EN_ATTENTE et notifie le tailleur', async () => {
    const id = await makeOrder('EN_ATTENTE');
    const res = await request(app).patch(`/orders/${id}/cancel`).set(auth(client.token));
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('ANNULEE');
    expect(await prisma.notification.count({ where: { recipientId: tailor.user.id, type: 'ORDER' } })).toBeGreaterThanOrEqual(1);
    const events = await prisma.orderEvent.findMany({ where: { orderId: id, status: 'ANNULEE' } });
    expect(events).toHaveLength(1);
  });

  it('annule aussi au stade TISSU_RECU', async () => {
    const id = await makeOrder('TISSU_RECU');
    const res = await request(app).patch(`/orders/${id}/cancel`).set(auth(client.token));
    expect(res.status).toBe(200);
  });

  it('refuse l’annulation dès COUPE (409)', async () => {
    const id = await makeOrder('COUPE');
    const res = await request(app).patch(`/orders/${id}/cancel`).set(auth(client.token));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ANNULATION_IMPOSSIBLE');
  });

  it('refuse un non-propriétaire (404) et un tailleur (403)', async () => {
    const id = await makeOrder('EN_ATTENTE');
    const autre = await registerUser(app, 'CLIENT', '+221770013003');
    expect((await request(app).patch(`/orders/${id}/cancel`).set(auth(autre.token))).status).toBe(404);
    expect((await request(app).patch(`/orders/${id}/cancel`).set(auth(tailor.token))).status).toBe(403);
  });
});
