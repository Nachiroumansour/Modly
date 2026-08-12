import { fireEvent, render, screen } from '@testing-library/react-native';
import { CommentItem } from './CommentItem';
import type { ApiComment } from '../types';

function c(over: Partial<ApiComment> = {}): ApiComment {
  return {
    id: 'c1',
    text: 'Joli',
    createdAt: '2026-08-12T00:00:00.000Z',
    parentId: null,
    pinned: false,
    likesCount: 2,
    likedByMe: false,
    user: { id: 'u1', name: 'Awa', avatarUrl: null },
    replies: [],
    ...over,
  };
}

const noop = { onLike: jest.fn(), onReply: jest.fn(), onDelete: jest.fn(), onPin: jest.fn() };

describe('CommentItem', () => {
  it('affiche texte, auteur, like et reponses', () => {
    render(
      <CommentItem
        comment={c({ replies: [c({ id: 'r1', text: 'Merci', parentId: 'c1', user: { id: 'u2', name: 'Bina', avatarUrl: null } })] })}
        viewerId="x"
        designTailorId="t"
        {...noop}
      />,
    );
    expect(screen.getByText('Joli')).toBeTruthy();
    expect(screen.getByText('Awa')).toBeTruthy();
    expect(screen.getByText('Merci')).toBeTruthy();
    fireEvent.press(screen.getByTestId('comment-like-c1'));
    expect(noop.onLike).toHaveBeenCalledWith('c1', false);
  });

  it('montre Supprimer pour l auteur et Epingler pour le tailleur', () => {
    const props = { onLike: jest.fn(), onReply: jest.fn(), onDelete: jest.fn(), onPin: jest.fn() };
    render(
      <CommentItem
        comment={c({ user: { id: 'me', name: 'Moi', avatarUrl: null } })}
        viewerId="me"
        designTailorId="me"
        {...props}
      />,
    );
    fireEvent.press(screen.getByTestId('comment-delete-c1'));
    expect(props.onDelete).toHaveBeenCalledWith('c1');
    fireEvent.press(screen.getByTestId('comment-pin-c1'));
    expect(props.onPin).toHaveBeenCalledWith('c1', true);
  });

  it('cache Supprimer/Epingler pour un tiers', () => {
    render(<CommentItem comment={c()} viewerId="autre" designTailorId="autre-tailleur" {...noop} />);
    expect(screen.queryByTestId('comment-delete-c1')).toBeNull();
    expect(screen.queryByTestId('comment-pin-c1')).toBeNull();
  });
});
