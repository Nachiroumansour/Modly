import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();

describe('collections CRUD', () => {
  let token: string;
  beforeEach(async () => {
    const c = await registerUser(app, 'CLIENT', '+221770007001');
    token = c.token;
  });

  it('cree, liste, renomme, supprime une collection', async () => {
    const create = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Mariage' });
    expect(create.status).toBe(201);
    const id = create.body.collection.id;

    const list = await request(app).get('/me/collections').set('Authorization', `Bearer ${token}`);
    expect(list.body.collections).toHaveLength(1);
    expect(list.body.collections[0]).toMatchObject({ name: 'Mariage', count: 0 });
    expect(Array.isArray(list.body.collections[0].covers)).toBe(true);

    const rename = await request(app).patch(`/me/collections/${id}`).set('Authorization', `Bearer ${token}`).send({ name: 'Mariages' });
    expect(rename.body.collection.name).toBe('Mariages');

    const del = await request(app).delete(`/me/collections/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  it('refuse un nom duplique (409)', async () => {
    await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Boubous' });
    const dup = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Boubous' });
    expect(dup.status).toBe(409);
  });

  it('404 sur la collection d un autre client', async () => {
    const create = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Prive' });
    const other = await registerUser(app, 'CLIENT', '+221770007099');
    const res = await request(app).patch(`/me/collections/${create.body.collection.id}`).set('Authorization', `Bearer ${other.token}`).send({ name: 'Vole' });
    expect(res.status).toBe(404);
  });
});

describe('ranger et detail', () => {
  let token: string;
  let designId: string;
  beforeEach(async () => {
    const c = await registerUser(app, 'CLIENT', '+221770007010');
    token = c.token;
    const t = await registerUser(app, 'TAILLEUR', '+221770007011');
    const d = await prisma.design.create({
      data: { tailorId: t.user.id, title: 'Robe', category: 'ROBE', imageUrl: '/uploads/r.webp', imageWidth: 600, imageHeight: 800 },
    });
    designId = d.id;
  });

  it('range un modele dans une collection puis le detail le renvoie', async () => {
    const col = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Envies' });
    const id = col.body.collection.id;

    const move = await request(app).patch(`/me/bookmarks/${designId}`).set('Authorization', `Bearer ${token}`).send({ collectionId: id });
    expect(move.status).toBe(204);

    const detail = await request(app).get(`/me/collections/${id}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.collection.name).toBe('Envies');
    expect(detail.body.designs.map((d: { id: string }) => d.id)).toContain(designId);

    const design = await prisma.design.findUnique({ where: { id: designId } });
    expect(design!.bookmarksCount).toBe(1);
  });

  it('supprimer la collection remet le bookmark non classe (pas de perte)', async () => {
    const col = await request(app).post('/me/collections').set('Authorization', `Bearer ${token}`).send({ name: 'X' });
    await request(app).patch(`/me/bookmarks/${designId}`).set('Authorization', `Bearer ${token}`).send({ collectionId: col.body.collection.id });
    await request(app).delete(`/me/collections/${col.body.collection.id}`).set('Authorization', `Bearer ${token}`);
    const all = await request(app).get('/me/bookmarks').set('Authorization', `Bearer ${token}`);
    expect(all.body.designs.map((d: { id: string }) => d.id)).toContain(designId);
  });
});
