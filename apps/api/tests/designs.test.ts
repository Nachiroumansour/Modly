import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

async function publishDesign(token: string, overrides: Record<string, string> = {}) {
  const req = request(app)
    .post('/designs')
    .set('Authorization', `Bearer ${token}`)
    .field('title', overrides.title ?? 'Boubou brodé or')
    .field('category', overrides.category ?? 'BOUBOU')
    .attach('media', await makeTestImage(), 'modele.jpg');
  if (overrides.description) req.field('description', overrides.description);
  return req;
}

describe('POST /designs', () => {
  it('publie un modèle avec image (tailleur)', async () => {
    const { token, user } = await registerUser(app, 'TAILLEUR', '+221770001001');
    const res = await publishDesign(token, { description: 'Bazin riche, broderie main' });
    expect(res.status).toBe(201);
    expect(res.body.design).toMatchObject({
      title: 'Boubou brodé or',
      category: 'BOUBOU',
      description: 'Bazin riche, broderie main',
      likesCount: 0,
      likedByMe: false,
      tailor: { id: user.id, name: 'Mamadou' },
    });
    expect(res.body.design.imageUrl).toMatch(/\/uploads\/.+\.webp$/);
    expect(res.body.design.imageWidth).toBe(600);
    expect(res.body.design.imageHeight).toBe(800);
  });

  it('refuse un client (403)', async () => {
    const { token } = await registerUser(app, 'CLIENT', '+221770001002');
    const res = await publishDesign(token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCES_REFUSE');
  });

  it('refuse sans image (400 IMAGE_REQUISE)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770001003');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Sans photo')
      .field('category', 'ROBE');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMAGE_REQUISE');
  });

  it('refuse une catégorie inconnue (400)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770001004');
    const res = await publishDesign(token, { category: 'PYJAMA' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DONNEES_INVALIDES');
  });

  it('refuse un fichier qui n\'est pas une image (400)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770001005');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Faux fichier')
      .field('category', 'ROBE')
      .attach('media', Buffer.from('pas une image'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FORMAT_IMAGE_INVALIDE');
  });
});

describe('GET /designs/:id', () => {
  it('renvoie le détail sans authentification', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770001006');
    const created = await publishDesign(token);
    const res = await request(app).get(`/designs/${created.body.design.id}`);
    expect(res.status).toBe(200);
    expect(res.body.design.title).toBe('Boubou brodé or');
    expect(res.body.design.likedByMe).toBe(false);
    expect(res.body.comments).toEqual([]);
  });

  it('renvoie 404 pour un id inconnu', async () => {
    const res = await request(app).get('/designs/inexistant123');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INTROUVABLE');
  });
});

describe('GET /designs — feed « Pour toi » (M7)', () => {
  // Publie dans l'ordre ci-dessous ; le dernier publié est le plus récent.
  async function seedMixedCatalog(tailorToken: string) {
    const catalogue = [
      ['boubou1', 'BOUBOU'],
      ['robe1', 'ROBE'],
      ['mariage1', 'MARIAGE'],
      ['boubou2', 'BOUBOU'],
      ['mariage2', 'MARIAGE'],
    ] as const;
    const ids: Record<string, string> = {};
    for (const [title, category] of catalogue) {
      const res = await publishDesign(tailorToken, { title, category });
      ids[title] = res.body.design.id as string;
    }
    return ids;
  }

  it('met en avant les catégories préférées sans exclure le reste', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770002001');
    await seedMixedCatalog(tailor);
    const { token: client } = await registerUser(app, 'CLIENT', '+221770002002', ['MARIAGE']);

    const res = await request(app).get('/designs').set('Authorization', `Bearer ${client}`);
    expect(res.status).toBe(200);
    expect(res.body.designs).toHaveLength(5);
    const cats = res.body.designs.map((d: { category: string }) => d.category);
    // Les 2 modèles MARIAGE en tête, le reste (autres catégories) ensuite.
    expect(cats.slice(0, 2)).toEqual(['MARIAGE', 'MARIAGE']);
    expect(cats.slice(2)).not.toContain('MARIAGE');
  });

  it('pagine en 2 phases (préférés puis autres) sans doublon ni perte', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770002003');
    await seedMixedCatalog(tailor);
    const { token: client } = await registerUser(app, 'CLIENT', '+221770002004', ['MARIAGE']);

    const ids: string[] = [];
    const cats: string[] = [];
    let cursor: string | null | undefined;
    for (let i = 0; i < 10; i++) {
      const url = cursor
        ? `/designs?limit=2&cursor=${encodeURIComponent(cursor)}`
        : '/designs?limit=2';
      const res = await request(app).get(url).set('Authorization', `Bearer ${client}`);
      expect(res.status).toBe(200);
      for (const d of res.body.designs) {
        ids.push(d.id);
        cats.push(d.category);
      }
      cursor = res.body.nextCursor;
      if (!cursor) break;
    }
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    // Tous les préférés arrivent avant les autres, malgré la pagination.
    expect(cats.slice(0, 2)).toEqual(['MARIAGE', 'MARIAGE']);
    expect(cats.slice(2)).not.toContain('MARIAGE');
  });

  it('reste chronologique pour un viewer sans centres d\'intérêt', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770002005');
    await seedMixedCatalog(tailor);
    const { token: client } = await registerUser(app, 'CLIENT', '+221770002006');

    const res = await request(app).get('/designs').set('Authorization', `Bearer ${client}`);
    expect(res.status).toBe(200);
    const times = res.body.designs.map((d: { createdAt: string }) => d.createdAt);
    expect(times).toEqual([...times].sort().reverse());
  });

  it('un filtre de catégorie court-circuite la personnalisation', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770002007');
    await seedMixedCatalog(tailor);
    const { token: client } = await registerUser(app, 'CLIENT', '+221770002008', ['MARIAGE']);

    const res = await request(app)
      .get('/designs?category=BOUBOU')
      .set('Authorization', `Bearer ${client}`);
    expect(res.status).toBe(200);
    expect(res.body.designs).toHaveLength(2);
    expect(res.body.designs.every((d: { category: string }) => d.category === 'BOUBOU')).toBe(true);
  });
});
