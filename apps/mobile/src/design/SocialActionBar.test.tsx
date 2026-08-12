import { fireEvent, render, screen } from '@testing-library/react-native';
import { SocialActionBar } from './SocialActionBar';

const base = {
  liked: false,
  saved: false,
  likesCount: 12,
  commentsCount: 3,
  bookmarksCount: 4,
  onLike: jest.fn(),
  onComment: jest.fn(),
  onShare: jest.fn(),
  onSave: jest.fn(),
};

describe('SocialActionBar', () => {
  it('affiche les compteurs', () => {
    render(<SocialActionBar {...base} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('declenche chaque action', () => {
    const props = {
      ...base,
      onLike: jest.fn(),
      onComment: jest.fn(),
      onShare: jest.fn(),
      onSave: jest.fn(),
    };
    render(<SocialActionBar {...props} />);
    fireEvent.press(screen.getByTestId('action-like'));
    fireEvent.press(screen.getByTestId('action-comment'));
    fireEvent.press(screen.getByTestId('action-share'));
    fireEvent.press(screen.getByTestId('action-save'));
    expect(props.onLike).toHaveBeenCalled();
    expect(props.onComment).toHaveBeenCalled();
    expect(props.onShare).toHaveBeenCalled();
    expect(props.onSave).toHaveBeenCalled();
  });
});
