import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('squelette API', () => {
  it('GET /health répond ok', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('renvoie une erreur normalisée sur une route inconnue', async () => {
    const res = await request(createApp()).get('/nexiste-pas');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'INTROUVABLE', message: 'Ressource introuvable.' },
    });
  });
});
