import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { assertTailor, getOwnedOrder, publicUserSelect } from './orders.service.js';

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
      design: { select: { id: true, title: true, imageUrl: true } },
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
      design: { select: { id: true, title: true, imageUrl: true } },
      clientRecord: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  res.json({ order });
});
