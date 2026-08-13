import type { Role, DesignCategory } from '@moodly/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import { registerPushToken, unregisterPushToken } from '../notifications/push';
import type { AuthResponse, AuthUser } from '../types';
import { clearToken, loadToken, saveToken } from './storage';

type RegisterInput = {
  phone: string;
  password: string;
  name: string;
  role: Role;
  interests?: DesignCategory[];
};

type AuthValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  register: (input: RegisterInput) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Au démarrage : restaurer la session depuis le stockage sécurisé.
  useEffect(() => {
    (async () => {
      const saved = await loadToken();
      if (saved) {
        try {
          const { user: me } = await apiFetch<{ user: AuthUser }>('/me', { token: saved });
          setUser(me);
          setToken(saved);
        } catch {
          await clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  async function applyAuth(res: AuthResponse) {
    await saveToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    registerPushToken(res.accessToken).catch(() => {});
  }

  async function register(input: RegisterInput) {
    const res = await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input });
    await applyAuth(res);
  }

  async function login(phone: string, password: string) {
    const res = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { phone, password },
    });
    await applyAuth(res);
  }

  async function logout() {
    if (token) {
      unregisterPushToken(token).catch(() => {});
    }
    await clearToken();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  return ctx;
}
