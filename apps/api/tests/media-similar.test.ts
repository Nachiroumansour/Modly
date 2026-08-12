import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function makeDesign(tailorId: string, title: string, category: string) {
  return prisma.design.create({
    data: {
      tailorId,
      title,
      category: category as never,
      imageUrl: `/uploads/${title}.webp`,
      imageWidth: 600,
      imageHeight: 800,
    },
  });
}

describe('GET /designs/:id/similar', () => {
  let current: { id: string };
  let sameTailor: { id: string };
  let otherTailorSameCat: { id: string };

  beforeEach(async () => {
    const a = await registerUser(app, 'TAILLEUR', '+221770005001');
    const b = await registerUser(app, 'TAILLEUR', '+221770005002');
    current = await makeDesign(a.user.id, 'courant', 'BOUBOU');
    sameTailor = await makeDesign(a.user.id, 'meme-tailleur', 'ROBE');
    otherTailorSameCat = await makeDesign(b.user.id, 'autre-tailleur', 'BOUBOU');
  });

  it('met les modeles du meme tailleur avant ceux de la meme categorie, exclut le courant', async () => {
    const res = await request(app).get(`/designs/${current.id}/similar`);
    expect(res.status).toBe(200);
    const ids = res.body.designs.map((d: { id: string }) => d.id);
    expect(ids).not.toContain(current.id);
    expect(ids[0]).toBe(sameTailor.id);
    expect(ids).toContain(otherTailorSameCat.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respecte limit', async () => {
    const res = await request(app).get(`/designs/${current.id}/similar?limit=1`);
    expect(res.body.designs).toHaveLength(1);
  });

  it('404 si le modele nexiste pas', async () => {
    const res = await request(app).get('/designs/inexistant/similar');
    expect(res.status).toBe(404);
  });
});
