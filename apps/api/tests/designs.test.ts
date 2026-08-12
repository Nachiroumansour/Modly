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
