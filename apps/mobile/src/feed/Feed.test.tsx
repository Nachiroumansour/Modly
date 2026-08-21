import { fireEvent, render, screen } from '@testing-library/react-native';
import { Feed } from './Feed';
import { useFeed } from './useFeed';
import type { Design } from '../types';

jest.mock('./useFeed');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockedUseFeed = useFeed as jest.MockedFunction<typeof useFeed>;

const design: Design = {
  id: 'd1',
  title: 'Robe wax',
  description: null,
  category: 'ROBE',
  postType: 'INSPIRATION',
  sourceCredit: null,
  imageUrl: 'http://x/img.webp',
  imageWidth: 600,
  imageHeight: 800,
  coverBlurhash: null,
  mediaCount: 1,
  media: [],
  likesCount: 0,
  commentsCount: 0,
  bookmarksCount: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  tailor: { id: 't1', name: 'Awa', avatarUrl: null },
  likedByMe: false,
  bookmarkedByMe: false,
};

function feedState(over: Partial<ReturnType<typeof useFeed>>) {
  return {
    designs: [],
    isLoading: false,
    isError: false,
    hasMore: false,
    refetch: jest.fn(),
    loadMore: jest.fn(),
    ...over,
  } as ReturnType<typeof useFeed>;
}

describe('Feed', () => {
  it('affiche les modèles', () => {
    mockedUseFeed.mockReturnValue(feedState({ designs: [design] }));
    render(<Feed />);
    expect(screen.getByText('Robe wax')).toBeTruthy();
  });

  it('affiche un état vide', () => {
    mockedUseFeed.mockReturnValue(feedState({ designs: [] }));
    render(<Feed />);
    expect(screen.getByText(/Aucun modèle/i)).toBeTruthy();
  });

  it('affiche un bouton Réessayer en cas d’erreur', () => {
    const refetch = jest.fn();
    mockedUseFeed.mockReturnValue(feedState({ isError: true, refetch }));
    render(<Feed />);
    fireEvent.press(screen.getByText('Réessayer'));
    expect(refetch).toHaveBeenCalled();
  });
});
