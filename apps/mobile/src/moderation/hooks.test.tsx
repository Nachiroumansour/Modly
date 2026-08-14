import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useBlock, useReport } from './hooks';

jest.mock('../lib/api');
jest.mock('../auth/AuthContext');
const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ token: 'tok' } as never);
  mockedFetch.mockResolvedValue({} as never);
});

it('useReport POST /reports', async () => {
  const { result } = renderHook(() => useReport(), { wrapper: wrapper() });
  await act(async () => {
    await result.current.report({ targetType: 'DESIGN', targetId: 'd1', reason: 'SPAM' });
  });
  expect(mockedFetch).toHaveBeenCalledWith(
    '/reports',
    expect.objectContaining({ method: 'POST', token: 'tok', body: { targetType: 'DESIGN', targetId: 'd1', reason: 'SPAM' } }),
  );
});

it('useBlock POST /users/:id/block', async () => {
  const { result } = renderHook(() => useBlock(), { wrapper: wrapper() });
  await act(async () => {
    await result.current.block('u1');
  });
  expect(mockedFetch).toHaveBeenCalledWith(
    '/users/u1/block',
    expect.objectContaining({ method: 'POST', token: 'tok' }),
  );
});
