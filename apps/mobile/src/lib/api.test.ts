import { apiFetch, ApiClientError } from './api';

describe('apiFetch', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('renvoie le JSON en cas de succès', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ designs: [], page: 1, hasMore: false }),
    }) as unknown as typeof fetch;

    const data = await apiFetch<{ page: number }>('/designs');
    expect(data.page).toBe(1);
  });

  it('jette une ApiClientError normalisée quand l’API renvoie une erreur', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 'DONNEES_INVALIDES', message: 'Champ requis.' } }),
    }) as unknown as typeof fetch;

    await expect(apiFetch('/designs')).rejects.toMatchObject({
      code: 'DONNEES_INVALIDES',
      message: 'Champ requis.',
    });
  });

  it('jette un message réseau français si fetch échoue', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    await expect(apiFetch('/designs')).rejects.toBeInstanceOf(ApiClientError);
    await expect(apiFetch('/designs')).rejects.toMatchObject({
      message: 'Connexion impossible. Réessaie.',
    });
  });

  it('ajoute le header Authorization quand un token est fourni', async () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = spy as unknown as typeof fetch;

    await apiFetch('/me', { token: 'abc' });
    const headers = spy.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer abc');
  });
});
