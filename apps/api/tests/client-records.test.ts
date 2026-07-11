import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { registerUser } from './helpers.js';

const app = createApp();

let tailorToken: string;
let autreTailleurToken: string;
let clientToken: string;
let clientId: string;

beforeEach(async () => {
  const tailor = await registerUser(app, 'TAILLEUR', '+221770006001');
  const autre = await registerUser(app, 'TAILLEUR', '+221770006002');
  const client = await registerUser(app, 'CLIENT', '+221770006003');
  tailorToken = tailor.token;
  autreTailleurToken = autre.token;
  clientToken = client.token;
  clientId = client.user.id;
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('POST /client-records', () => {
  it('crée une fiche minimale (nom seul) pour le tailleur', async () => {
    const res = await request(app)
      .post('/client-records')
      .set(auth(tailorToken))
      .send({ name: 'Awa Ndiaye', phone: '+221771112233' });
    expect(res.status).toBe(201);
    expect(res.body.record.name).toBe('Awa Ndiaye');
    expect(res.body.record.phone).toBe('+221771112233');
    expect(res.body.record.id).toBeTruthy();
  });

  it('peut lier un compte client existant', async () => {
    const res = await request(app)
      .post('/client-records')
      .set(auth(tailorToken))
      .send({ name: 'Client lié', userId: clientId });
    expect(res.status).toBe(201);
    expect(res.body.record.userId).toBe(clientId);
  });

  it('refuse un userId qui n’est pas un client (400)', async () => {
    const res = await request(app)
      .post('/client-records')
      .set(auth(tailorToken))
      .send({ name: 'X', userId: 'inexistant' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CLIENT_INVALIDE');
  });

  it('refuse un nom vide (400)', async () => {
    const res = await request(app).post('/client-records').set(auth(tailorToken)).send({});
    expect(res.status).toBe(400);
  });

  it('refuse un client (403) et l’anonyme (401)', async () => {
    expect(
      (await request(app).post('/client-records').set(auth(clientToken)).send({ name: 'X' })).status,
    ).toBe(403);
    expect((await request(app).post('/client-records').send({ name: 'X' })).status).toBe(401);
  });
});

describe('GET /client-records', () => {
  it('ne liste que les fiches du tailleur courant', async () => {
    await request(app).post('/client-records').set(auth(tailorToken)).send({ name: 'A' });
    await request(app).post('/client-records').set(auth(tailorToken)).send({ name: 'B' });
    await request(app).post('/client-records').set(auth(autreTailleurToken)).send({ name: 'PasMoi' });

    const res = await request(app).get('/client-records').set(auth(tailorToken));
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(2);
    expect(res.body.records.map((r: { name: string }) => r.name)).not.toContain('PasMoi');
  });
});

async function createRecord(token: string, name = 'Fiche') {
  const res = await request(app).post('/client-records').set(auth(token)).send({ name });
  return res.body.record.id as string;
}

describe('GET/PATCH/DELETE /client-records/:id', () => {
  it('lit, modifie puis supprime sa propre fiche', async () => {
    const id = await createRecord(tailorToken, 'Coumba');

    const get = await request(app).get(`/client-records/${id}`).set(auth(tailorToken));
    expect(get.status).toBe(200);
    expect(get.body.record.name).toBe('Coumba');

    const patch = await request(app)
      .patch(`/client-records/${id}`)
      .set(auth(tailorToken))
      .send({ notes: 'Préfère les coupes amples', tissuPref: 'Bazin' });
    expect(patch.status).toBe(200);
    expect(patch.body.record.notes).toBe('Préfère les coupes amples');
    expect(patch.body.record.tissuPref).toBe('Bazin');

    const del = await request(app).delete(`/client-records/${id}`).set(auth(tailorToken));
    expect(del.status).toBe(204);
    expect((await request(app).get(`/client-records/${id}`).set(auth(tailorToken))).status).toBe(404);
  });

  it('404 pour la fiche d’un autre tailleur (pas de fuite)', async () => {
    const id = await createRecord(autreTailleurToken, 'PasMoi');
    expect((await request(app).get(`/client-records/${id}`).set(auth(tailorToken))).status).toBe(404);
    expect(
      (await request(app).patch(`/client-records/${id}`).set(auth(tailorToken)).send({ notes: 'x' })).status,
    ).toBe(404);
    expect((await request(app).delete(`/client-records/${id}`).set(auth(tailorToken))).status).toBe(404);
  });

  it('refuse un PATCH vide (400)', async () => {
    const id = await createRecord(tailorToken);
    expect((await request(app).patch(`/client-records/${id}`).set(auth(tailorToken)).send({})).status).toBe(400);
  });
});
