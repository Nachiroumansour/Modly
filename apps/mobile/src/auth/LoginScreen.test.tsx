import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from './LoginScreen';
import { useAuth } from './AuthContext';

jest.mock('./AuthContext');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LoginScreen', () => {
  beforeEach(() => mockReplace.mockClear());

  it('affiche le bouton Google (placeholder) et les champs', () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<LoginScreen />);
    expect(screen.getByText('Continuer avec Google')).toBeTruthy();
    expect(screen.getByText('Téléphone')).toBeTruthy();
    expect(screen.getByText('Me connecter')).toBeTruthy();
  });

  it('affiche une note quand on tape sur Google (pas encore branché)', () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Continuer avec Google'));
    expect(screen.getByText(/bientôt/i)).toBeTruthy();
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
