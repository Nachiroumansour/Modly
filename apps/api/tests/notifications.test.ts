import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';
import { createNotification, sendPush } from '../src/modules/notifications/notifications.service.js';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const app = createApp();

let tailorId: string;
let awaId: string;
let oumarId: string;
let designId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770010001');
  const awa = await registerUser(app, 'CLIENT', '+221770010002');
  const oumar = await registerUser(app, 'CLIENT', '+221770010003');
  tailorId = tailor.user.id;
  awaId = awa.user.id;
  oumarId = oumar.user.id;
  const design = await prisma.design.create({
    data: {
      tailorId, title: 'Boubou', category: 'BOUBOU',
      imageUrl: 'http://x/o.webp', imageWidth: 600, imageHeight: 800,
    },
  });
  designId = design.id;
});

describe('createNotification (regroupement)', () => {
  it('regroupe deux likes sur un modele en une notif (actorCount=2)', async () => {
    await createNotification({ recipientId: tailorId, actorId: awaId, type: 'LIKE', groupKey: `design:${designId}`, designId });
    await createNotification({ recipientId: tailorId, actorId: oumarId, type: 'LIKE', groupKey: `design:${designId}`, designId });
    const notifs = await prisma.notification.findMany({ where: { recipientId: tailorId } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].actorCount).toBe(2);
    expect(notifs[0].lastActorId).toBe(oumarId);
    expect(notifs[0].read).toBe(false);
  });

  it('ne cree jamais d\'auto-notification', async () => {
    await createNotification({ recipientId: tailorId, actorId: tailorId, type: 'LIKE', groupKey: `design:${designId}`, designId });
    const count = await prisma.notification.count({ where: { recipientId: tailorId } });
    expect(count).toBe(0);
  });

  it('des groupKey differents creent des notifs distinctes', async () => {
    await createNotification({ recipientId: tailorId, actorId: awaId, type: 'COMMENT', groupKey: 'comment:c1', designId, commentId: 'c1' });
    await createNotification({ recipientId: tailorId, actorId: awaId, type: 'COMMENT', groupKey: 'comment:c2', designId, commentId: 'c2' });
    const count = await prisma.notification.count({ where: { recipientId: tailorId } });
    expect(count).toBe(2);
  });
});

describe('sendPush (best-effort)', () => {
  it('no-op quand le destinataire n\'a aucun jeton (fetch non appele)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await sendPush(tailorId, { title: 'x', body: 'y' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('poste vers Expo quand un jeton existe', async () => {
    await prisma.pushToken.create({ data: { userId: tailorId, token: 'ExponentPushToken[abc]' } });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ status: 'ok' }] }), { status: 200 }),
    );
    await sendPush(tailorId, { title: 'Titre', body: 'Corps', data: { type: 'LIKE' } });
    expect(spy).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', expect.objectContaining({ method: 'POST' }));
    spy.mockRestore();
  });
});

describe('GET /me/notifications', () => {
  it('liste les notifs du destinataire avec lastActor + compteur non-lu', async () => {
    const tailor = await registerUser(app, 'TAILLEUR', '+221770010009');
    const awa = await registerUser(app, 'CLIENT', '+221770010010');
    const design = await prisma.design.create({
      data: { tailorId: tailor.user.id, title: 'B', category: 'BOUBOU', imageUrl: 'http://x/o.webp', imageWidth: 600, imageHeight: 800 },
    });
    await createNotification({ recipientId: tailor.user.id, actorId: awa.user.id, type: 'LIKE', groupKey: `design:${design.id}`, designId: design.id });

    const list = await request(app).get('/me/notifications').set(auth(tailor.token));
    expect(list.status).toBe(200);
    expect(list.body.notifications).toHaveLength(1);
    expect(list.body.notifications[0].type).toBe('LIKE');
    expect(list.body.notifications[0].lastActor.name).toBe('Fatou');
    expect(list.body.notifications[0].design.id).toBe(design.id);

    const unread = await request(app).get('/me/notifications/unread-count').set(auth(tailor.token));
    expect(unread.body.count).toBe(1);

    await request(app).post('/me/notifications/read-all').set(auth(tailor.token));
    const unread2 = await request(app).get('/me/notifications/unread-count').set(auth(tailor.token));
    expect(unread2.body.count).toBe(0);
  });

  it("exige l'authentification (401)", async () => {
    expect((await request(app).get('/me/notifications')).status).toBe(401);
  });
});
