import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { storage } from '../src/lib/storage.js';
import { prisma } from '../src/lib/prisma.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();

afterEach(() => vi.restoreAllMocks());

describe('attribution des créations (M8)', () => {
  it('ORIGINAL : sourceCredit vidé même si envoyé, filigrane appliqué à chaque image', async () => {
    const saveSpy = vi.spyOn(storage, 'save');
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100001');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Ma création')
      .field('category', 'ROBE')
      .field('postType', 'ORIGINAL')
      .field('sourceCredit', 'ignore-moi')
      .attach('media', await makeTestImage(600, 800), 'a.jpg')
      .attach('media', await makeTestImage(600, 800), 'b.jpg');
    expect(res.status).toBe(201);
    expect(res.body.design.postType).toBe('ORIGINAL');
    expect(res.body.design.sourceCredit).toBeNull();
    // Un filigrane est demandé pour chacune des 2 images, avec le format exact de liage.
    expect(saveSpy).toHaveBeenCalledTimes(2);
    for (const call of saveSpy.mock.calls) {
      expect(call[1]).toMatchObject({ watermark: '© Mamadou · Modly' });
    }
  });

  it("ORIGINAL : nom du tailleur absent -> filigrane replie sur « © Modly · Modly »", async () => {
    const saveSpy = vi.spyOn(storage, 'save');
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100005');
    // Simule un tailleur sans nom exploitable (une seule résolution, pour ce POST).
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({ name: null } as never);
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Ma création sans nom')
      .field('category', 'ROBE')
      .field('postType', 'ORIGINAL')
      .attach('media', await makeTestImage(600, 800), 'a.jpg');
    expect(res.status).toBe(201);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][1]).toMatchObject({ watermark: '© Modly · Modly' });
  });

  it('INSPIRATION : sourceCredit persisté, aucun filigrane', async () => {
    const saveSpy = vi.spyOn(storage, 'save');
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100002');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Inspiration Pinterest')
      .field('category', 'ROBE')
      .field('postType', 'INSPIRATION')
      .field('sourceCredit', 'Pinterest / @awa')
      .attach('media', await makeTestImage(600, 800), 'a.jpg');
    expect(res.status).toBe(201);
    expect(res.body.design.postType).toBe('INSPIRATION');
    expect(res.body.design.sourceCredit).toBe('Pinterest / @awa');
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][1]).toBeUndefined();
  });

  it('sans champ : défaut INSPIRATION, sourceCredit null', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100003');
    const res = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Par défaut')
      .field('category', 'ROBE')
      .attach('media', await makeTestImage(600, 800), 'a.jpg');
    expect(res.status).toBe(201);
    expect(res.body.design.postType).toBe('INSPIRATION');
    expect(res.body.design.sourceCredit).toBeNull();
  });

  it('feed et détail exposent postType et sourceCredit', async () => {
    const { token } = await registerUser(app, 'TAILLEUR', '+221771100004');
    const created = await request(app)
      .post('/designs')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Exposée')
      .field('category', 'ROBE')
      .field('postType', 'INSPIRATION')
      .field('sourceCredit', 'Source X')
      .attach('media', await makeTestImage(600, 800), 'a.jpg');
    const id = created.body.design.id as string;

    const detail = await request(app).get(`/designs/${id}`);
    expect(detail.body.design.postType).toBe('INSPIRATION');
    expect(detail.body.design.sourceCredit).toBe('Source X');

    const feed = await request(app).get('/designs');
    const found = feed.body.designs.find((d: { id: string }) => d.id === id);
    expect(found.postType).toBe('INSPIRATION');
    expect(found.sourceCredit).toBe('Source X');
  });
});
