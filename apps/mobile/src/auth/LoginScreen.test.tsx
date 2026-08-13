import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from './LoginScreen';
import { useAuth } from './AuthContext';
import { useAuthCovers } from './useAuthCovers';

jest.mock('./AuthContext');
jest.mock('./useAuthCovers');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAuthCovers = useAuthCovers as jest.MockedFunction<typeof useAuthCovers>;

describe('LoginScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockedUseAuthCovers.mockReturnValue([]);
  });

  it('affiche la marque et les champs de connexion', () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<LoginScreen />);
    expect(screen.getByText('Modly')).toBeTruthy();
    expect(screen.getByText('Téléphone')).toBeTruthy();
    expect(screen.getByText('Me connecter')).toBeTruthy();
  });

  it('connecte puis redirige vers l’accueil', async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ login } as unknown as ReturnType<typeof useAuth>);
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Me connecter'));
    await waitFor(() => expect(login).toHaveBeenCalled());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
