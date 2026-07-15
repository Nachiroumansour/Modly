import { render, screen } from '@testing-library/react-native';
import { DesignCard } from './DesignCard';
import type { Design } from '../types';

const base: Design = {
  id: 'd1',
  title: 'Boubou Tabaski',
  description: null,
  category: 'TABASKI',
  imageUrl: 'http://x/img.webp',
  imageWidth: 600,
  imageHeight: 900,
  coverBlurhash: null,
  mediaCount: 1,
  media: [],
  likesCount: 3,
  commentsCount: 1,
  bookmarksCount: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  tailor: { id: 't1', name: 'Atelier Awa', avatarUrl: null },
  likedByMe: false,
  bookmarkedByMe: false,
};

describe('DesignCard', () => {
  it('affiche l’image et un titre sobre (sans bandeau)', () => {
    render(<DesignCard design={base} onPress={() => {}} />);
    expect(screen.getByTestId('design-image')).toBeTruthy();
    expect(screen.getByText('Boubou Tabaski')).toBeTruthy();
    expect(screen.queryByText('Atelier Awa')).toBeNull();
  });

  it('préserve le ratio réel de l’image (Pinterest)', () => {
    render(<DesignCard design={base} onPress={() => {}} />);
    const image = screen.getByTestId('design-image');
    const flat = Array.isArray(image.props.style)
      ? Object.assign({}, ...image.props.style)
      : image.props.style;
    expect(flat.aspectRatio).toBeCloseTo(600 / 900);
  });

  it('affiche l’indicateur multi-média quand mediaCount > 1', () => {
    render(<DesignCard design={{ ...base, mediaCount: 3 }} onPress={() => {}} />);
    expect(screen.getByTestId('multi-indicator')).toBeTruthy();
  });

  it('n’affiche pas l’indicateur pour une seule image', () => {
    render(<DesignCard design={base} onPress={() => {}} />);
    expect(screen.queryByTestId('multi-indicator')).toBeNull();
  });
});
