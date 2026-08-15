import { render, screen } from '@testing-library/react-native';
import ProfileTab from '../profile';
import { useAuth } from '../../../src/auth/AuthContext';
import { useTailorProfile } from '../../../src/tailors/hooks';

jest.mock('../../../src/auth/AuthContext');
jest.mock('../../../src/tailors/hooks');
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../src/ui/AppHeader', () => ({ AppHeader: () => null }));

(useAuth as jest.Mock).mockReturnValue({
  user: { id: 't1', name: 'Awa', role: 'TAILLEUR' },
  logout: jest.fn(),
});
(useTailorProfile as jest.Mock).mockReturnValue({
  tailor: {
    id: 't1',
    name: 'Awa',
    avatarUrl: null,
    likesTotal: 42,
    designsCount: 5,
    followersCount: 9,
    profile: null,
  },
  designs: [],
});

it('affiche le bouton Modifier le profil pour un tailleur', () => {
  render(<ProfileTab />);
  expect(screen.getByText(/Modifier le profil/i)).toBeTruthy();
});
