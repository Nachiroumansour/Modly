import { Router } from 'express';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const PAGE = 30;

notificationsRouter.get('/', async (req, res) => {
  const cursor = req.query.cursor as string | undefined;
  const rows = await prisma.notification.findMany({
    where: { recipientId: req.user!.sub },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      lastActor: { select: { id: true, name: true, avatarUrl: true } },
      design: { select: { id: true, title: true, imageUrl: true, coverBlurhash: true } },
    },
  });
  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;
  res.json({
    notifications: page.map((n) => ({
      id: n.id,
      type: n.type,
      actorCount: n.actorCount,
      read: n.read,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      lastActor: n.lastActor,
      design: n.design,
      commentId: n.commentId,
      orderId: n.orderId,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

notificationsRouter.get('/unread-count', async (req, res) => {
  const count = await prisma.notification.count({ where: { recipientId: req.user!.sub, read: false } });
  res.json({ count });
});

notificationsRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { recipientId: req.user!.sub, read: false }, data: { read: true } });
  res.json({ ok: true });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const id = req.params.id as string;
  const notif = await prisma.notification.findUnique({ where: { id }, select: { recipientId: true } });
  if (!notif || notif.recipientId !== req.user!.sub) {
    throw new ApiError(404, 'INTROUVABLE', 'Notification introuvable.');
  }
  await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json({ ok: true });
});
