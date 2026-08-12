import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';
import { createNotification } from '../src/modules/notifications/notifications.service.js';

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
