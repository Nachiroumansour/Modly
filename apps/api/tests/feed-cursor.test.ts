import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

async function design(tailorId: string, title: string) {
  return prisma.design.create({
    data: { tailorId, title, category: 'ROBE', imageUrl: `/uploads/${title}.webp`, imageWidth: 600, imageHeight: 800 },
  });
}

describe('feed curseur', () => {
  let tailorId: string;
  beforeEach(async () => {
    const t = await registerUser(app, 'TAILLEUR', '+221770008001');
    tailorId = t.user.id;
    await design(tailorId, 'a');
    await design(tailorId, 'b');
    await design(tailorId, 'c');
  });

  it('pagine par curseur sans doublon', async () => {
    const p1 = await request(app).get('/designs?limit=2');
    expect(p1.status).toBe(200);
    expect(p1.body.designs).toHaveLength(2);
    expect(p1.body.nextCursor).toEqual(expect.any(String));

    const p2 = await request(app).get(`/designs?limit=2&cursor=${p1.body.nextCursor}`);
    const ids1 = p1.body.designs.map((d: { id: string }) => d.id);
    const ids2 = p2.body.designs.map((d: { id: string }) => d.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toHaveLength(0);
    expect(p2.body.nextCursor).toBeNull();
  });

  it('mode page (recherche) renvoie page/hasMore', async () => {
    const res = await request(app).get('/designs?page=1&limit=2');
    expect(res.body).toMatchObject({ page: 1 });
    expect(typeof res.body.hasMore).toBe('boolean');
  });
});

describe('feed abonnements', () => {
  it('ne renvoie que les tailleurs suivis, 401 sans auth', async () => {
    const a = await registerUser(app, 'TAILLEUR', '+221770008010');
    const b = await registerUser(app, 'TAILLEUR', '+221770008011');
    await design(a.user.id, 'suivi');
    await design(b.user.id, 'pasSuivi');
    const client = await registerUser(app, 'CLIENT', '+221770008012');
    await request(app).post(`/tailors/${a.user.id}/follow`).set('Authorization', `Bearer ${client.token}`);

    const anon = await request(app).get('/designs?following=1');
    expect(anon.status).toBe(401);

    const res = await request(app).get('/designs?following=1').set('Authorization', `Bearer ${client.token}`);
    const titles = res.body.designs.map((d: { title: string }) => d.title);
    expect(titles).toContain('suivi');
    expect(titles).not.toContain('pasSuivi');
  });
});
