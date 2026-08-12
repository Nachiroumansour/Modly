import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

describe('upload multi-images', () => {
  it('publie 3 images → 3 Media ordonnés, cover = 1re, mediaCount = 3, blurhash présents', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770003001');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Carrousel')
      .field('category', 'ENSEMBLE')
      .attach('media', await makeTestImage(600, 800), 'a.jpg')
      .attach('media', await makeTestImage(600, 900), 'b.jpg')
      .attach('media', await makeTestImage(600, 700), 'c.jpg');
    expect(res.status).toBe(201);
    expect(res.body.design.mediaCount).toBe(3);
    expect(res.body.design.media).toHaveLength(3);
    expect(res.body.design.media[0].position).toBe(0);
    expect(res.body.design.media[2].position).toBe(2);
    expect(res.body.design.imageUrl).toBe(res.body.design.media[0].url);
    expect(res.body.design.coverBlurhash).toEqual(expect.any(String));
    expect(res.body.design.media[0].blurhash).toEqual(expect.any(String));
  });

  it('refuse 0 image (400)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770003002');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Sans image')
      .field('category', 'ROBE');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMAGE_REQUISE');
  });

  it('refuse 6 images (400)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770003003');
    const req = request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Trop')
      .field('category', 'ROBE');
    for (let i = 0; i < 6; i++) req.attach('media', await makeTestImage(600, 800), `x${i}.jpg`);
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CHAMP_MEDIA');
  });

  it('refuse un fichier sous l ancien champ image (400, CHAMP_MEDIA)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770003005');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Mauvais champ')
      .field('category', 'ROBE')
      .attach('image', await makeTestImage(), 'x.png');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CHAMP_MEDIA');
  });

  it('refuse un fichier non-image (400)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770003004');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'PDF')
      .field('category', 'ROBE')
      .attach('media', Buffer.from('%PDF-1.4 fake'), { filename: 'f.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });
});
