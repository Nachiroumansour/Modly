import * as Notifications from 'expo-notifications';
import { apiFetch } from '../lib/api';

/** Recupere l'Expo push token (permission + device) puis l'enregistre cote API. Best-effort. */
export async function registerPushToken(authToken: string): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return; // refus : on n'insiste pas
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync();
    if (!expoToken) return;
    await apiFetch('/me/push-tokens', { method: 'POST', body: { token: expoToken }, token: authToken });
  } catch {
    // Expo Go SDK 54 (push retire) ou toute erreur : silencieux, l'app continue.
  }
}

/** Desenregistre le token cote API. Best-effort. */
export async function unregisterPushToken(authToken: string): Promise<void> {
  try {
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync();
    if (!expoToken) return;
    await apiFetch(`/me/push-tokens/${encodeURIComponent(expoToken)}`, { method: 'DELETE', token: authToken });
  } catch {
    // silencieux
  }
}
