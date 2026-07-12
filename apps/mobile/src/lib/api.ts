import { API_URL } from './config';

/** Erreur normalisée côté client, portant le code API et un message français. */
export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

/**
 * Appel API : préfixe la base URL, pose le token, parse le JSON et jette une
 * ApiClientError en français en cas d'erreur API ou de coupure réseau.
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiClientError('RESEAU', 'Connexion impossible. Réessaie.');
  }

  const data = await res.json().catch(() => ({}) as unknown);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } }).error;
    throw new ApiClientError(
      err?.code ?? 'ERREUR',
      err?.message ?? 'Une erreur est survenue.',
      res.status,
    );
  }
  return data as T;
}

/** Envoi multipart (upload d'image). On laisse fetch poser le Content-Type + boundary. */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(API_URL + path, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiClientError('RESEAU', 'Connexion impossible. Réessaie.');
  }

  const data = await res.json().catch(() => ({}) as unknown);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } }).error;
    throw new ApiClientError(
      err?.code ?? 'ERREUR',
      err?.message ?? "L'envoi a échoué.",
      res.status,
    );
  }
  return data as T;
}
