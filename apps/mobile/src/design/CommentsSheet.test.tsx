import { fireEvent, render, screen } from '@testing-library/react-native';
import { CommentsSheet } from './CommentsSheet';
import type { Comment } from '../types';

const comments: Comment[] = [
  { id: 'c1', text: 'Trop beau', createdAt: '2026-07-15T00:00:00.000Z', user: { id: 'u1', name: 'Awa', avatarUrl: null } },
];

const base = {
  visible: true,
  onClose: jest.fn(),
  comments,
  commentText: '',
  setCommentText: jest.fn(),
  submitComment: jest.fn(),
  commenting: false,
  authed: true,
  onRequireAuth: jest.fn(),
};

describe('CommentsSheet', () => {
  it('affiche le titre et les commentaires quand visible', () => {
    render(<CommentsSheet {...base} />);
    expect(screen.getByText('Commentaires')).toBeTruthy();
    expect(screen.getByText('Trop beau')).toBeTruthy();
    expect(screen.getByText('Awa')).toBeTruthy();
  });

  it('envoie un commentaire quand connecte', () => {
    const submitComment = jest.fn();
    render(<CommentsSheet {...base} submitComment={submitComment} />);
    fireEvent.press(screen.getByTestId('comment-send'));
    expect(submitComment).toHaveBeenCalled();
  });

  it('invite a se connecter quand non connecte', () => {
    const onRequireAuth = jest.fn();
    render(<CommentsSheet {...base} authed={false} onRequireAuth={onRequireAuth} />);
    expect(screen.queryByTestId('comment-send')).toBeNull();
    fireEvent.press(screen.getByText(/Connecte-toi/));
    expect(onRequireAuth).toHaveBeenCalled();
  });

  it('ferme via le backdrop', () => {
    const onClose = jest.fn();
    render(<CommentsSheet {...base} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('comments-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
