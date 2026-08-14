import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeTestImage, registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function publish(token: string, title: string) {
  const res = await request(app)
    .post('/designs')
    .set(auth(token))
    .field('title', title)
    .field('category', 'BOUBOU')
    .attach('media', await makeTestImage(), 'm.jpg');
  return res.body.design.id as string;
}

describe('Effets du blocage (M5)', () => {
  it('le feed exclut les modèles d’un tailleur bloqué', async () => {
    const { user: t, token: tailor } = await registerUser(app, 'TAILLEUR', '+221770008001');
    await publish(tailor, 'Modele bloque');
    const { token: viewer } = await registerUser(app, 'CLIENT', '+221770008002');

    const before = await request(app).get('/designs').set(auth(viewer));
    expect(before.body.designs.length).toBeGreaterThan(0);

    await request(app).post(`/users/${t.id}/block`).set(auth(viewer));
    const after = await request(app).get('/designs').set(auth(viewer));
    expect(after.body.designs.length).toBe(0);
  });

  it('les commentaires d’un utilisateur bloqué sont masqués', async () => {
    const { token: tailor } = await registerUser(app, 'TAILLEUR', '+221770008003');
    const designId = await publish(tailor, 'A');
    const { token: viewer } = await registerUser(app, 'CLIENT', '+221770008004');
    const { token: troll, user: trollUser } = await registerUser(app, 'CLIENT', '+221770008005');
    await request(app).post(`/designs/${designId}/comments`).set(auth(troll)).send({ text: 'spam' });

    const withComment = await request(app).get(`/designs/${designId}`).set(auth(viewer));
    expect(withComment.body.comments.length).toBe(1);

    await request(app).post(`/users/${trollUser.id}/block`).set(auth(viewer));
    const hidden = await request(app).get(`/designs/${designId}`).set(auth(viewer));
    expect(hidden.body.comments.length).toBe(0);
  });

  it('suivre un utilisateur bloqué est refusé (403)', async () => {
    const { token: viewer } = await registerUser(app, 'CLIENT', '+221770008006');
    const { user: t } = await registerUser(app, 'TAILLEUR', '+221770008007');
    await request(app).post(`/users/${t.id}/block`).set(auth(viewer));
    const follow = await request(app).post(`/tailors/${t.id}/follow`).set(auth(viewer));
    expect(follow.status).toBe(403);
  });
});
