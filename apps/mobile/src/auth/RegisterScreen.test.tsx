import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RegisterScreen from './RegisterScreen';
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

describe('RegisterScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockedUseAuthCovers.mockReturnValue([]);
  });

  it('affiche la marque, le choix de rôle et les champs', () => {
    mockedUseAuth.mockReturnValue({ register: jest.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<RegisterScreen />);
    expect(screen.getByText('Modly')).toBeTruthy();
    expect(screen.getByText('Client')).toBeTruthy();
    expect(screen.getByText('Tailleur')).toBeTruthy();
    expect(screen.getByText('Créer mon compte')).toBeTruthy();
  });

  it('s’inscrit avec le rôle choisi (Tailleur)', async () => {
    const register = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ register } as unknown as ReturnType<typeof useAuth>);
    render(<RegisterScreen />);
    fireEvent.press(screen.getByText('Tailleur'));
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][0]).toMatchObject({ role: 'TAILLEUR' });
  });
});
