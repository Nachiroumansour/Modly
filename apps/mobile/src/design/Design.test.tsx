import { fireEvent, render, screen } from '@testing-library/react-native';
import { DesignScreen } from './DesignScreen';
import { useDesign } from './useDesign';
import type { Design } from '../types';

jest.mock('./useDesign');
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: null, token: null }) }));
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

const design: Design = {
  id: 'd1',
  title: 'Ensemble Korité',
  description: 'Bazin riche',
  category: 'KORITE',
  imageUrl: 'http://x/img.webp',
  imageWidth: 600,
  imageHeight: 800,
  likesCount: 12,
  commentsCount: 2,
  bookmarksCount: 4,
  createdAt: '2026-07-11T00:00:00.000Z',
  tailor: { id: 't1', name: 'Atelier Awa', avatarUrl: null },
  likedByMe: false,
  bookmarkedByMe: false,
};

function state(over: Partial<ReturnType<typeof useDesign>>) {
  return {
    design: null,
    comments: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    ...over,
  } as ReturnType<typeof useDesign>;
}

describe('DesignScreen', () => {
  it('affiche le titre, le tailleur, les compteurs et les commentaires', () => {
    mockedUseDesign.mockReturnValue(
      state({
        design,
        comments: [
          { id: 'c1', text: 'Magnifique !', createdAt: '2026-07-11T00:00:00.000Z', user: { id: 'u1', name: 'Fatou', avatarUrl: null } },
        ],
      }),
    );
    render(<DesignScreen id="d1" />);
    expect(screen.getByText('Ensemble Korité')).toBeTruthy();
    expect(screen.getByText(/Atelier Awa/)).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Magnifique !')).toBeTruthy();
  });

  it('invite à se connecter quand on tente une action', () => {
    const onRequireAuth = jest.fn();
    mockedUseDesign.mockReturnValue(state({ design, comments: [] }));
    render(<DesignScreen id="d1" onRequireAuth={onRequireAuth} />);
    fireEvent.press(screen.getByText('Commander ce modèle'));
    expect(onRequireAuth).toHaveBeenCalled();
  });

  it('affiche Réessayer en cas d’erreur', () => {
    const refetch = jest.fn();
    mockedUseDesign.mockReturnValue(state({ isError: true, refetch }));
    render(<DesignScreen id="d1" />);
    fireEvent.press(screen.getByText('Réessayer'));
    expect(refetch).toHaveBeenCalled();
  });
});
