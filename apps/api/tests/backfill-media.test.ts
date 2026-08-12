import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { backfillDesignMedia } from '../src/lib/backfillMedia.js';

let tailorId: string;
let designId: string;

beforeEach(async () => {
  const tailor = await prisma.user.create({
    data: { phone: '+221770003333', name: 'Backfill', role: 'TAILLEUR', passwordHash: 'x' },
  });
  tailorId = tailor.id;
  const d = await prisma.design.create({
    data: { tailorId, title: 'Ancien', category: 'ROBE', imageUrl: '/uploads/old.webp', imageWidth: 600, imageHeight: 800 },
  });
  designId = d.id;
});

describe('backfillDesignMedia', () => {
  it('crée un Media position 0 depuis la cover pour un design sans média', async () => {
    // readImage renvoie null (fichier absent) → blurhash null toléré
    const count = await backfillDesignMedia(async () => null);
    expect(count).toBeGreaterThanOrEqual(1);
    const media = await prisma.media.findMany({ where: { designId } });
    expect(media).toHaveLength(1);
    expect(media[0].position).toBe(0);
    expect(media[0].url).toBe('/uploads/old.webp');
    expect(media[0].type).toBe('IMAGE');
  });

  it('est idempotent (ne recrée pas de média)', async () => {
    await backfillDesignMedia(async () => null);
    await backfillDesignMedia(async () => null);
    const media = await prisma.media.findMany({ where: { designId } });
    expect(media).toHaveLength(1);
  });
});
