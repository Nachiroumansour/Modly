import Constants from 'expo-constants';

/**
 * Base URL de l'API.
 *
 * Priorité :
 * 1. EXPO_PUBLIC_API_URL si défini (prod / réglage explicite).
 * 2. Sinon, en dev, on déduit automatiquement l'IP de la machine depuis l'hôte
 *    de Metro (le serveur Expo et l'API tournent sur la même machine).
 *    → aucune config ni IP à saisir : ça marche sur un vrai téléphone via Expo Go.
 * 3. Sinon, localhost (simulateur sur la même machine).
 */
const API_PORT = 3000;

function deriveFromMetro(): string | null {
  const c = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
  };
  const hostUri = c.expoConfig?.hostUri ?? c.expoGoConfig?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  if (!host) return null;
  return `http://${host}:${API_PORT}`;
}

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? deriveFromMetro() ?? `http://localhost:${API_PORT}`;

/**
 * Résout l'URI d'une image renvoyée par l'API.
 * - Chemin relatif (`/uploads/x.webp`) → préfixé par `API_URL` (suit l'hôte courant,
 *   donc ne casse jamais quand l'IP LAN change).
 * - URL absolue (`http…`) → renvoyée telle quelle (rétro-compat / Cloudinary).
 */
export function imageUri(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
