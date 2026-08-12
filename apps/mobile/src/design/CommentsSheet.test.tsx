import { fireEvent, render, screen } from '@testing-library/react-native';
import { CommentsSheet } from './CommentsSheet';

jest.mock('./useComments', () => ({
  useComments: () => ({
    comments: [
      {
        id: 'c1',
        text: 'Trop beau',
        createdAt: '',
        parentId: null,
        pinned: false,
        likesCount: 0,
        likedByMe: false,
        user: { id: 'u1', name: 'Awa', avatarUrl: null },
        replies: [],
      },
    ],
    isLoading: false,
    post: jest.fn(),
    toggleLike: jest.fn(),
    remove: jest.fn(),
    togglePin: jest.fn(),
  }),
}));

const base = {
  visible: true,
  onClose: jest.fn(),
  designId: 'd1',
  viewerId: 'me',
  designTailorId: 't1',
  authed: true,
  onRequireAuth: jest.fn(),
};

describe('CommentsSheet', () => {
  it('affiche le titre et les commentaires threadés', () => {
    render(<CommentsSheet {...base} />);
    expect(screen.getByText('Commentaires')).toBeTruthy();
    expect(screen.getByText('Trop beau')).toBeTruthy();
    expect(screen.getByText('Awa')).toBeTruthy();
  });

  it('ferme via le backdrop', () => {
    const onClose = jest.fn();
    render(<CommentsSheet {...base} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('comments-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('invite a se connecter quand non connecte', () => {
    const onRequireAuth = jest.fn();
    render(<CommentsSheet {...base} authed={false} onRequireAuth={onRequireAuth} />);
    expect(screen.queryByTestId('comment-send')).toBeNull();
    fireEvent.press(screen.getByText(/Connecte-toi/));
    expect(onRequireAuth).toHaveBeenCalled();
  });
});
