import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthCollage } from './AuthCollage';
import { useAuthCovers } from './useAuthCovers';

jest.mock('./useAuthCovers');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockedUseAuthCovers = useAuthCovers as jest.MockedFunction<typeof useAuthCovers>;

describe('AuthCollage', () => {
  it('affiche le contenu superposé (marque)', () => {
    mockedUseAuthCovers.mockReturnValue([]);
    render(
      <AuthCollage>
        <Text>Modly</Text>
      </AuthCollage>,
    );
    expect(screen.getByText('Modly')).toBeTruthy();
  });

  it('affiche le repli quand aucune couverture', () => {
    mockedUseAuthCovers.mockReturnValue([]);
    render(<AuthCollage />);
    expect(screen.getByTestId('auth-collage-fallback')).toBeTruthy();
    expect(screen.queryAllByTestId('auth-collage-image')).toHaveLength(0);
  });

  it('affiche une mosaïque des couvertures disponibles', () => {
    mockedUseAuthCovers.mockReturnValue([
      'http://x/a.webp',
      'http://x/b.webp',
      'http://x/c.webp',
      'http://x/d.webp',
      'http://x/e.webp',
      'http://x/f.webp',
    ]);
    render(<AuthCollage />);
    expect(screen.queryByTestId('auth-collage-fallback')).toBeNull();
    expect(screen.getAllByTestId('auth-collage-image')).toHaveLength(6);
  });
});
