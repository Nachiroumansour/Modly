import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SignupWizard from './SignupWizard';
import { useAuth } from './AuthContext';

jest.mock('./AuthContext');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('SignupWizard', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockBack.mockClear();
  });

  it('parcourt les étapes et inscrit avec rôle + centres d’intérêt', async () => {
    const register = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ register } as unknown as ReturnType<typeof useAuth>);
    render(<SignupWizard />);

    // Étape 1 : téléphone
    expect(screen.getByText('Quel est ton numéro ?')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('+221 77 000 00 00'), '+221770000123');
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 2 : mot de passe
    fireEvent.changeText(screen.getByPlaceholderText('Crée un mot de passe fort'), 'secret123');
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 3 : prénom
    fireEvent.changeText(screen.getByPlaceholderText('Awa'), 'Awa');
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 4 : rôle
    fireEvent.press(screen.getByText('Tailleur'));
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 5 : centres d'intérêt (3 minimum)
    expect(screen.getByText("Qu'est-ce qui t'inspire ?")).toBeTruthy();
    fireEvent.press(screen.getByText('Mariage'));
    fireEvent.press(screen.getByText('Robe'));
    fireEvent.press(screen.getByText('Boubou'));
    fireEvent.press(screen.getByText('Créer mon compte'));

    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][0]).toMatchObject({
      phone: '+221770000123',
      password: 'secret123',
      name: 'Awa',
      role: 'TAILLEUR',
      interests: ['MARIAGE', 'ROBE', 'BOUBOU'],
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('bloque Suivant tant que le numéro est invalide', () => {
    const register = jest.fn();
    mockedUseAuth.mockReturnValue({ register } as unknown as ReturnType<typeof useAuth>);
    render(<SignupWizard />);
    fireEvent.press(screen.getByText('Suivant')); // rien saisi -> bouton désactivé
    expect(screen.getByText('Quel est ton numéro ?')).toBeTruthy(); // toujours à l'étape 1
  });
});
