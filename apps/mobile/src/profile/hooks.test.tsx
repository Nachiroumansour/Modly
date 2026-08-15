import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { apiFetch, apiUpload } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useUpdateProfile, useUploadProfilePhotos } from './hooks';

jest.mock('../lib/api');
jest.mock('../auth/AuthContext');

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockedUpload = apiUpload as jest.MockedFunction<typeof apiUpload>;
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
});

it('useUpdateProfile PATCH /me/profile avec le corps + token', async () => {
  mockedFetch.mockResolvedValue({} as never);
  const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper() });
  await act(async () => {
    await result.current.save({ bio: 'Bazin', priceMin: 15000 });
  });
  expect(mockedFetch).toHaveBeenCalledWith(
    '/me/profile',
    expect.objectContaining({ method: 'PATCH', token: 'tok', body: { bio: 'Bazin', priceMin: 15000 } }),
  );
});

it('useUploadProfilePhotos POST /me/photos en multipart', async () => {
  mockedUpload.mockResolvedValue({ avatarUrl: 'a', coverUrl: null } as never);
  const { result } = renderHook(() => useUploadProfilePhotos(), { wrapper: wrapper() });
  await act(async () => {
    await result.current.upload({ avatarUri: 'file:///a.jpg' });
  });
  expect(mockedUpload).toHaveBeenCalledWith('/me/photos', expect.any(FormData), 'tok');
});
