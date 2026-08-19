import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PublishWizard from './PublishWizard';
import { usePublishDesign } from '../designs/hooks';

jest.mock('../designs/hooks');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));

// La galerie renvoie 1 photo choisie.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photo1.jpg' }],
  }),
}));

const mockedUsePublish = usePublishDesign as jest.MockedFunction<typeof usePublishDesign>;

// Le passage à l'étape 1 dépend d'un `setState` déclenché par la résolution de la
// promesse d'ouverture de galerie (montage), hors du cycle synchrone d'un `fireEvent`.
// Le Pressable met un cycle d'effet supplémentaire à synchroniser sa configuration
// interne (disabled -> enabled) après une telle mise à jour asynchrone : on retente
// la pression dans un `waitFor` jusqu'à ce que l'étape suivante soit bien affichée,
// sans jamais alléger les assertions finales du test.
async function pressUntilVisible(label: string, expectAdvanced: () => void) {
  await waitFor(() => {
    fireEvent.press(screen.getByText(label));
    expectAdvanced();
  });
}

describe('PublishWizard', () => {
  beforeEach(() => mockReplace.mockClear());

  it('parcourt les 3 étapes et publie une création originale (sourceCredit non envoyé)', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    mockedUsePublish.mockReturnValue({ publish, publishing: false });
    render(<PublishWizard />);

    // Étape 1 — Média : la galerie s'ouvre au montage et renvoie 1 photo.
    await waitFor(() => expect(screen.getByText('Suivant')).toBeTruthy());
    await pressUntilVisible('Suivant', () =>
      expect(screen.getByPlaceholderText('Boubou brodé, Robe wax…')).toBeTruthy(),
    );

    // Étape 2 — L'essentiel : titre + catégorie.
    fireEvent.changeText(screen.getByPlaceholderText('Boubou brodé, Robe wax…'), 'Ma création');
    fireEvent.press(screen.getByText('Robe'));
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 3 — Finitions : passer en Création originale puis publier.
    fireEvent.press(screen.getByText('Création originale'));
    fireEvent.press(screen.getByText('Publier'));

    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][0]).toMatchObject({
      uris: ['file:///photo1.jpg'],
      title: 'Ma création',
      category: 'ROBE',
      postType: 'ORIGINAL',
    });
    expect(publish.mock.calls[0][0].sourceCredit).toBeUndefined();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/profile'));
  });

  it('publie une inspiration avec source', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    mockedUsePublish.mockReturnValue({ publish, publishing: false });
    render(<PublishWizard />);

    await waitFor(() => expect(screen.getByText('Suivant')).toBeTruthy());
    await pressUntilVisible('Suivant', () =>
      expect(screen.getByPlaceholderText('Boubou brodé, Robe wax…')).toBeTruthy(),
    );
    fireEvent.changeText(screen.getByPlaceholderText('Boubou brodé, Robe wax…'), 'Inspiration');
    fireEvent.press(screen.getByText('Boubou'));
    fireEvent.press(screen.getByText('Suivant'));

    // Étape 3 : Inspiration est le défaut → le champ Source apparaît.
    fireEvent.changeText(screen.getByPlaceholderText('Crédit ou lien (optionnel)'), 'Pinterest');
    fireEvent.press(screen.getByText('Publier'));

    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][0]).toMatchObject({
      postType: 'INSPIRATION',
      sourceCredit: 'Pinterest',
    });
  });
});
