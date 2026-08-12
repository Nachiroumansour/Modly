import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

let tailorId: string;
let designId: string;

beforeEach(async () => {
  const tailor = await prisma.user.create({
    data: { phone: '+221770001111', name: 'Média Tailleur', role: 'TAILLEUR', passwordHash: 'x' },
  });
  tailorId = tailor.id;
  const design = await prisma.design.create({
    data: {
      tailorId,
      title: 'Trois vues',
      category: 'BOUBOU',
      imageUrl: '/uploads/a.webp',
      imageWidth: 600,
      imageHeight: 800,
      coverBlurhash: 'LEHV6nWB2yk8',
      mediaCount: 2,
      media: {
        create: [
          { type: 'IMAGE', url: '/uploads/a.webp', width: 600, height: 800, blurhash: 'LEHV6nWB2yk8', position: 0 },
          { type: 'IMAGE', url: '/uploads/b.webp', width: 600, height: 900, blurhash: 'L6Pj0^jE', position: 1 },
        ],
      },
    },
  });
  designId = design.id;
});

describe('lecture média', () => {
  it('GET /designs/:id renvoie media[] ordonné + cover + mediaCount', async () => {
    const res = await request(app).get(`/designs/${designId}`);
    expect(res.status).toBe(200);
    expect(res.body.design.mediaCount).toBe(2);
    expect(res.body.design.coverBlurhash).toBe('LEHV6nWB2yk8');
    expect(res.body.design.media).toHaveLength(2);
    expect(res.body.design.media[0].position).toBe(0);
    expect(res.body.design.media[1].position).toBe(1);
    expect(res.body.design.media[0].url).toBe('/uploads/a.webp');
  });

  it('GET /designs (feed) renvoie media[] et mediaCount', async () => {
    const res = await request(app).get('/designs?limit=50');
    const found = res.body.designs.find((d: { id: string }) => d.id === designId);
    expect(found.mediaCount).toBe(2);
    expect(found.media).toHaveLength(2);
  });
});
