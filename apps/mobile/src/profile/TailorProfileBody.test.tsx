import { fireEvent, render, screen } from '@testing-library/react-native';
import { TailorProfileBody } from './TailorProfileBody';
import type { Design } from '../types';

const design: Design = {
  id: 'd1', title: 'Boubou fête', description: null, category: 'BOUBOU',
  postType: 'INSPIRATION', sourceCredit: null,
  imageUrl: 'http://x/img.webp', imageWidth: 600, imageHeight: 800,
  coverBlurhash: null, mediaCount: 1, media: [],
  likesCount: 0, commentsCount: 0, bookmarksCount: 0, createdAt: '2026-07-14T00:00:00.000Z',
  tailor: { id: 't1', name: 'Modou', avatarUrl: null }, likedByMe: false, bookmarkedByMe: false,
};

function setup(over: Partial<Parameters<typeof TailorProfileBody>[0]> = {}) {
  const props = { designs: [design], onPublish: jest.fn(), onOpenClients: jest.fn(), onOpenDesign: jest.fn(), ...over };
  render(<TailorProfileBody {...props} />);
  return props;
}

describe('TailorProfileBody', () => {
  it('affiche la grille des modèles du tailleur', () => {
    setup();
    expect(screen.getByText('Boubou fête')).toBeTruthy();
  });

  it('propose de publier quand aucun modèle', () => {
    const props = setup({ designs: [] });
    fireEvent.press(screen.getByTestId('profile-publish'));
    expect(props.onPublish).toHaveBeenCalled();
  });

  it('ouvre les fiches clients', () => {
    const props = setup();
    fireEvent.press(screen.getByTestId('profile-clients'));
    expect(props.onOpenClients).toHaveBeenCalled();
  });
});
