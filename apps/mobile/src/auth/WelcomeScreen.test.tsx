import { fireEvent, render, screen } from '@testing-library/react-native';
import WelcomeScreen from './WelcomeScreen';
import { useAuthCovers } from './useAuthCovers';

jest.mock('./useAuthCovers');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockedUseAuthCovers = useAuthCovers as jest.MockedFunction<typeof useAuthCovers>;

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockedUseAuthCovers.mockReturnValue([]);
  });

  it('propose s’inscrire et se connecter', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("S'inscrire")).toBeTruthy();
    expect(screen.getByText('Se connecter')).toBeTruthy();
  });

  it('navigue vers l’inscription et la connexion', () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByText("S'inscrire"));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/signup');
    fireEvent.press(screen.getByText('Se connecter'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });
});
