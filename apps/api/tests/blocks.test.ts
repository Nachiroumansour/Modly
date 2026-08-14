import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Blocage (M5)', () => {
  it('bloque, liste, débloque', async () => {
    const { token: a } = await registerUser(app, 'CLIENT', '+221770007001');
    const { user: b } = await registerUser(app, 'TAILLEUR', '+221770007002');

    const block = await request(app).post(`/users/${b.id}/block`).set(auth(a));
    expect(block.status).toBe(204);

    const list = await request(app).get('/me/blocks').set(auth(a));
    expect(list.body.blockedIds).toContain(b.id);

    const unblock = await request(app).delete(`/users/${b.id}/block`).set(auth(a));
    expect(unblock.status).toBe(204);
    const list2 = await request(app).get('/me/blocks').set(auth(a));
    expect(list2.body.blockedIds).not.toContain(b.id);
  });

  it('refuse de se bloquer soi-même (400)', async () => {
    const { token, user } = await registerUser(app, 'CLIENT', '+221770007003');
    const res = await request(app).post(`/users/${user.id}/block`).set(auth(token));
    expect(res.status).toBe(400);
  });

  it('404 si la cible est inconnue', async () => {
    const { token } = await registerUser(app, 'CLIENT', '+221770007004');
    const res = await request(app).post('/users/inexistant/block').set(auth(token));
    expect(res.status).toBe(404);
  });

  it('bloquer supprime les follows croisés', async () => {
    const { token: a } = await registerUser(app, 'CLIENT', '+221770007005');
    const { user: ub } = await registerUser(app, 'TAILLEUR', '+221770007006');
    await request(app).post(`/tailors/${ub.id}/follow`).set(auth(a)); // a suit b
    await request(app).post(`/users/${ub.id}/block`).set(auth(a));    // a bloque b

    const following = await request(app).get('/designs?following=1').set(auth(a));
    expect(following.status).toBe(200);
    // a ne suit plus b : le feed abonnements est vide.
    expect(following.body.designs.length).toBe(0);
  });
});
