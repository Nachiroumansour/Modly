/**
 * Base URL de l'API. Configurable via EXPO_PUBLIC_API_URL.
 * ⚠️ Sur un vrai téléphone (Expo Go), `localhost` pointe vers le téléphone :
 * mettre l'IP LAN de la machine, ex. EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
