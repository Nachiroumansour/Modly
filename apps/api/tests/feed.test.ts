import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function seedDesigns(tailorId: string) {
  // Insertion directe en base : plus rapide que 25 uploads multipart.
  const rows = Array.from({ length: 25 }, (_, i) => ({
    tailorId,
    title: i % 2 === 0 ? `Boubou tabaski ${i}` : `Robe soirée ${i}`,
    category: (i % 2 === 0 ? 'TABASKI' : 'ROBE') as 'TABASKI' | 'ROBE',
    imageUrl: `http://localhost:3000/uploads/seed-${i}.webp`,
    imageWidth: 600,
    imageHeight: 800,
    likesCount: i === 3 ? 99 : 0,
  }));
  await prisma.design.createMany({ data: rows });
}

describe('GET /designs (feed)', () => {
  let tailorId: string;

  beforeEach(async () => {
    const { user } = await registerUser(app, 'TAILLEUR', '+221770002001');
    tailorId = user.id;
    await seedDesigns(tailorId);
  });

  it('pagine le feed par curseur sans authentification (20 par défaut, nextCursor)', async () => {
    const res = await request(app).get('/designs');
    expect(res.status).toBe(200);
    expect(res.body.designs).toHaveLength(20);
    expect(res.body.nextCursor).toEqual(expect.any(String));
    expect(res.body.designs[0].likedByMe).toBe(false);
    expect(res.body.designs[0].tailor.id).toBe(tailorId);
  });

  it('renvoie la page 2 avec hasMore=false', async () => {
    const res = await request(app).get('/designs?page=2');
    expect(res.status).toBe(200);
    expect(res.body.designs).toHaveLength(5);
    expect(res.body.hasMore).toBe(false);
  });

  it('filtre par catégorie', async () => {
    const res = await request(app).get('/designs?category=TABASKI&limit=50');
    expect(res.status).toBe(200);
    expect(res.body.designs).toHaveLength(13);
    for (const d of res.body.designs) expect(d.category).toBe('TABASKI');
  });

  it('recherche dans le titre (insensible à la casse)', async () => {
    const res = await request(app).get('/designs?search=ROBE%20SOIR&limit=50');
    expect(res.status).toBe(200);
    expect(res.body.designs.length).toBeGreaterThan(0);
    for (const d of res.body.designs) expect(d.title.toLowerCase()).toContain('robe soir');
  });

  it('trie par tendance (le plus liké en premier)', async () => {
    const res = await request(app).get('/designs?sort=tendance&page=1');
    expect(res.status).toBe(200);
    expect(res.body.designs[0].likesCount).toBe(99);
  });

  it('rejette une catégorie invalide (400)', async () => {
    const res = await request(app).get('/designs?category=PYJAMA');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });
});
