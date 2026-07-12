import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { apiFetch } from '../lib/api';

jest.mock('../lib/api');
jest.mock('./storage', () => ({
  saveToken: jest.fn(),
  loadToken: jest.fn().mockResolvedValue(null),
  clearToken: jest.fn(),
}));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext', () => {
  beforeEach(() => jest.clearAllMocks());

  it('démarre déconnecté quand aucun token n’est stocké', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('login stocke le token et peuple l’utilisateur', async () => {
    mockedFetch.mockResolvedValueOnce({
      accessToken: 'tok-123',
      refreshToken: 'ref',
      user: { id: 'u1', phone: '+221770000000', name: 'Awa', role: 'CLIENT', avatarUrl: null },
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('+221770000000', 'secret123');
    });

    expect(result.current.token).toBe('tok-123');
    expect(result.current.user?.name).toBe('Awa');
  });

  it('logout efface la session', async () => {
    mockedFetch.mockResolvedValueOnce({
      accessToken: 'tok-123',
      refreshToken: 'ref',
      user: { id: 'u1', phone: '+221770000000', name: 'Awa', role: 'CLIENT', avatarUrl: null },
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('+221770000000', 'secret123');
    });
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
