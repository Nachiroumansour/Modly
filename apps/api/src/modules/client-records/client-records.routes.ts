import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  assertLinkedClient,
  getOwnedRecord,
  measurementSchema,
} from './client-records.service.js';

export const clientRecordsRouter = Router();

// Toutes les routes : tailleur authentifié.
clientRecordsRouter.use(requireAuth, requireRole('TAILLEUR'));

const createSchema = z.object({
  name: z.string().min(1, 'Le nom du client est requis.').max(120),
  phone: z.string().min(4).max(30).optional(),
  userId: z.string().min(1).optional(),
  stylePref: z.string().max(200).optional(),
  tissuPref: z.string().max(200).optional(),
  coupePref: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

clientRecordsRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  await assertLinkedClient(parsed.data.userId);
  const record = await prisma.clientRecord.create({
    data: { ...parsed.data, tailorId: req.user!.sub },
  });
  res.status(201).json({ record });
});

clientRecordsRouter.get('/', async (req, res) => {
  const records = await prisma.clientRecord.findMany({
    where: { tailorId: req.user!.sub },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ records });
});

const updateSchema = createSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Aucune donnée à modifier.' },
);

clientRecordsRouter.get('/:id', async (req, res) => {
  const record = await getOwnedRecord(req.user!.sub, req.params.id as string);
  const latestMeasurement = await prisma.measurement.findFirst({
    where: { clientRecordId: record.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ record, latestMeasurement });
});

clientRecordsRouter.patch('/:id', async (req, res) => {
  await getOwnedRecord(req.user!.sub, req.params.id as string);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  await assertLinkedClient(parsed.data.userId);
  const record = await prisma.clientRecord.update({
    where: { id: req.params.id as string },
    data: parsed.data,
  });
  res.json({ record });
});

clientRecordsRouter.delete('/:id', async (req, res) => {
  await getOwnedRecord(req.user!.sub, req.params.id as string);
  await prisma.clientRecord.delete({ where: { id: req.params.id as string } });
  res.status(204).send();
});

clientRecordsRouter.post('/:id/measurements', async (req, res) => {
  await getOwnedRecord(req.user!.sub, req.params.id as string);
  const parsed = measurementSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  const [measurement] = await prisma.$transaction([
    prisma.measurement.create({
      data: { ...parsed.data, clientRecordId: req.params.id as string },
    }),
    prisma.clientRecord.update({
      where: { id: req.params.id as string },
      data: { updatedAt: new Date() },
    }),
  ]);
  res.status(201).json({ measurement });
});

clientRecordsRouter.get('/:id/measurements', async (req, res) => {
  await getOwnedRecord(req.user!.sub, req.params.id as string);
  const measurements = await prisma.measurement.findMany({
    where: { clientRecordId: req.params.id as string },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ measurements });
});
