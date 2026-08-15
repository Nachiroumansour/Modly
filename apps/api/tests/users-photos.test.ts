import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

describe('POST /me/photos (M6)', () => {
  it('met à jour avatar et couverture', async () => {
    const { token, user } = await registerUser(app, 'TAILLEUR', '+221770005001');
    const res = await request(app)
      .post('/me/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', await makeTestImage(200, 200), 'a.jpg')
      .attach('cover', await makeTestImage(1200, 675), 'c.jpg');
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toMatch(/\/uploads\/.+\.webp$/);
    expect(res.body.coverUrl).toMatch(/\/uploads\/.+\.webp$/);

    const me = await request(app).get(`/tailors/${user.id}`);
    expect(me.body.tailor.avatarUrl).toBe(res.body.avatarUrl);
    expect(me.body.tailor.profile.coverUrl).toBe(res.body.coverUrl);
  });

  it('accepte un seul fichier (avatar seul)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770005002');
    const res = await request(app)
      .post('/me/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', await makeTestImage(), 'a.jpg');
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toMatch(/\.webp$/);
    expect(res.body.coverUrl).toBeNull();
  });

  it('refuse sans fichier (400 IMAGE_REQUISE)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770005003');
    const res = await request(app).post('/me/photos').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMAGE_REQUISE');
  });

  it('refuse un fichier non-image (400 FORMAT_IMAGE_INVALIDE)', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221770005004');
    const res = await request(app)
      .post('/me/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('pas une image'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FORMAT_IMAGE_INVALIDE');
  });

  it('refuse un client (403)', async () => {
    const { token } = await registerUser(app, 'CLIENT', '+221770005005');
    const res = await request(app)
      .post('/me/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', await makeTestImage(), 'a.jpg');
    expect(res.status).toBe(403);
  });
});
