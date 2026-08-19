import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { DesignScreen } from './DesignScreen';
import { useDesign } from './useDesign';
import { useSimilar } from './useSimilar';
import type { Design } from '../types';

jest.mock('./useDesign');
jest.mock('./useSimilar');
jest.mock('./useComments', () => ({
  useComments: () => ({
    comments: [],
    isLoading: false,
    post: jest.fn(),
    toggleLike: jest.fn(),
    remove: jest.fn(),
    togglePin: jest.fn(),
  }),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, token: 't' }) }));
jest.mock('./useDesignActions', () => ({
  useDesignActions: () => ({
    toggleLike: jest.fn(),
    toggleBookmark: jest.fn(),
    commentText: '',
    setCommentText: jest.fn(),
    submitComment: jest.fn(),
    commenting: false,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockedUseDesign = useDesign as jest.MockedFunction<typeof useDesign>;
const mockedUseSimilar = useSimilar as jest.MockedFunction<typeof useSimilar>;

function makeDesign(over: Partial<Design> = {}): Design {
  return {
    id: 'd1',
    title: 'Ensemble Korite',
    description: 'Bazin riche',
    category: 'KORITE',
    postType: 'INSPIRATION',
    sourceCredit: null,
    imageUrl: 'http://x/img.webp',
    imageWidth: 600,
    imageHeight: 800,
    coverBlurhash: null,
    mediaCount: 1,
    media: [],
    likesCount: 12,
    commentsCount: 2,
    bookmarksCount: 4,
    createdAt: '2026-07-11T00:00:00.000Z',
    tailor: { id: 't1', name: 'Atelier Awa', avatarUrl: null },
    likedByMe: false,
    bookmarkedByMe: false,
    ...over,
  };
}

beforeEach(() => {
  mockedUseDesign.mockReturnValue({
    design: makeDesign(),
    comments: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as ReturnType<typeof useDesign>);
  mockedUseSimilar.mockReturnValue({ designs: [], isLoading: false, isError: false });
});

function renderScreen(props: ComponentProps<typeof DesignScreen>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DesignScreen {...props} />
    </QueryClientProvider>,
  );
}

describe('DesignScreen', () => {
  it('affiche le titre et la barre d actions', () => {
    renderScreen({ id: 'd1' });
    expect(screen.getByText('Ensemble Korite')).toBeTruthy();
    expect(screen.getByTestId('action-like')).toBeTruthy();
    expect(screen.getByTestId('action-save')).toBeTruthy();
  });

  it('ouvre le profil du tailleur', () => {
    const onTailor = jest.fn();
    renderScreen({ id: 'd1', onTailor });
    fireEvent.press(screen.getByText(/Atelier Awa/));
    expect(onTailor).toHaveBeenCalledWith('t1');
  });

  it('affiche les similaires et en ouvre un', () => {
    const onOpenDesign = jest.fn();
    mockedUseSimilar.mockReturnValue({
      designs: [makeDesign({ id: 'd2', title: 'Boubou fete' })],
      isLoading: false,
      isError: false,
    });
    renderScreen({ id: 'd1', onOpenDesign });
    expect(screen.getByText(/Explorer davantage/i)).toBeTruthy();
    fireEvent.press(screen.getByText('Boubou fete'));
    expect(onOpenDesign).toHaveBeenCalledWith('d2');
  });

  it('ouvre le popup commentaires en tapant licone commentaire', () => {
    renderScreen({ id: 'd1' });
    expect(screen.queryByText('Commentaires')).toBeNull();
    fireEvent.press(screen.getByTestId('action-comment'));
    expect(screen.getByText('Commentaires')).toBeTruthy();
  });
});
