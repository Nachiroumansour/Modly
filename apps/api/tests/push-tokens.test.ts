import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from './helpers.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('/me/push-tokens', () => {
  it('enregistre puis supprime un jeton', async () => {
    const u = await registerUser(app, 'CLIENT', '+221770011001');
    const add = await request(app).post('/me/push-tokens').set(auth(u.token)).send({ token: 'ExponentPushToken[z]' });
    expect(add.status).toBe(200);
    expect(await prisma.pushToken.count({ where: { userId: u.user.id } })).toBe(1);

    // upsert idempotent
    await request(app).post('/me/push-tokens').set(auth(u.token)).send({ token: 'ExponentPushToken[z]' });
    expect(await prisma.pushToken.count({ where: { userId: u.user.id } })).toBe(1);

    const del = await request(app).delete('/me/push-tokens/' + encodeURIComponent('ExponentPushToken[z]')).set(auth(u.token));
    expect(del.status).toBe(200);
    expect(await prisma.pushToken.count({ where: { userId: u.user.id } })).toBe(0);
  });

  it('exige l’authentification (401)', async () => {
    expect((await request(app).post('/me/push-tokens').send({ token: 'x' })).status).toBe(401);
  });
});
