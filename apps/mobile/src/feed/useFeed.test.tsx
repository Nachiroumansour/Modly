import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useFeed } from './useFeed';

jest.mock('../lib/api');
jest.mock('../auth/AuthContext');

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetch.mockResolvedValue({ designs: [], nextCursor: null } as never);
  });

  it('scope « foryou » envoie le token d’auth (déclenche le feed perso serveur)', async () => {
    mockedUseAuth.mockReturnValue({ token: 'tok-123' } as never);

    const { result } = renderHook(() => useFeed('foryou'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/designs?'),
      expect.objectContaining({ token: 'tok-123' }),
    );
  });
});
