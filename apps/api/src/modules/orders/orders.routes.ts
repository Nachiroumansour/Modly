import { ORDER_STATUSES, PAYMENT_STATUSES } from '@moodly/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { createNotification } from '../notifications/notifications.service.js';
import {
  assertTailor,
  assertTransition,
  getOwnedOrder,
  publicUserSelect,
  snapshotFromRecord,
} from './orders.service.js';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const createSchema = z.object({
  tailorId: z.string().min(1),
  designId: z.string().min(1).optional(),
  note: z.string().max(1000).optional(),
});

ordersRouter.post('/', requireRole('CLIENT'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  await assertTailor(parsed.data.tailorId);
  if (parsed.data.designId) {
    const design = await prisma.design.findUnique({
      where: { id: parsed.data.designId },
      select: { id: true },
    });
    if (!design) {
      throw new ApiError(400, 'MODELE_INVALIDE', 'Le modèle choisi est introuvable.');
    }
  }
  const order = await prisma.order.create({
    data: {
      clientId: req.user!.sub,
      tailorId: parsed.data.tailorId,
      designId: parsed.data.designId,
      note: parsed.data.note,
      events: { create: { status: 'EN_ATTENTE' } },
    },
  });
  await createNotification({
    recipientId: parsed.data.tailorId,
    actorId: req.user!.sub,
    type: 'ORDER',
    groupKey: `order:${order.id}:EN_ATTENTE`,
    orderId: order.id,
    designId: parsed.data.designId ?? null,
  });
  res.status(201).json({ order });
});

ordersRouter.get('/', async (req, res) => {
  const where =
    req.user!.role === 'TAILLEUR'
      ? { tailorId: req.user!.sub }
      : { clientId: req.user!.sub };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: publicUserSelect },
      tailor: { select: publicUserSelect },
      design: { select: { id: true, title: true, imageUrl: true, coverBlurhash: true } },
    },
  });
  res.json({ orders });
});

ordersRouter.get('/:id', async (req, res) => {
  await getOwnedOrder(req.user!.sub, req.params.id as string);
  const order = await prisma.order.findUnique({
    where: { id: req.params.id as string },
    include: {
      client: { select: publicUserSelect },
      tailor: { select: publicUserSelect },
      design: { select: { id: true, title: true, imageUrl: true, coverBlurhash: true } },
      clientRecord: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  res.json({ order });
});

const patchSchema = z
  .object({
    agreedPrice: z.number().int().min(0).optional(),
    estimatedDelivery: z.coerce.date().optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    clientRecordId: z.string().min(1).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune donnée à modifier.' });

ordersRouter.patch('/:id', requireRole('TAILLEUR'), async (req, res) => {
  const order = await getOwnedOrder(req.user!.sub, req.params.id as string);
  if (order.tailorId !== req.user!.sub) {
    throw new ApiError(404, 'INTROUVABLE', 'Commande introuvable.');
  }
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const data: Prisma.OrderUncheckedUpdateInput = { ...parsed.data };
  if (parsed.data.clientRecordId) {
    const snapshot = await snapshotFromRecord(req.user!.sub, parsed.data.clientRecordId);
    if (snapshot) {
      data.measurementsSnapshot = snapshot;
    }
  }
  const updated = await prisma.order.update({ where: { id: order.id }, data });
  res.json({ order: updated });
});

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(500).optional(),
});

ordersRouter.patch('/:id/status', requireRole('TAILLEUR'), async (req, res) => {
  const order = await getOwnedOrder(req.user!.sub, req.params.id as string);
  if (order.tailorId !== req.user!.sub) {
    throw new ApiError(404, 'INTROUVABLE', 'Commande introuvable.');
  }
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  assertTransition(order.status, parsed.data.status);
  const [updated] = await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: parsed.data.status } }),
    prisma.orderEvent.create({
      data: { orderId: order.id, status: parsed.data.status, note: parsed.data.note },
    }),
  ]);
  const withEvents = await prisma.order.findUnique({
    where: { id: updated.id },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  await createNotification({
    recipientId: order.clientId,
    actorId: req.user!.sub,
    type: 'ORDER',
    groupKey: `order:${order.id}:${parsed.data.status}`,
    orderId: order.id,
  });
  res.json({ order: withEvents });
});
