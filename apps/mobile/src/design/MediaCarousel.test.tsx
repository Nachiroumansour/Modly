import { render, screen } from '@testing-library/react-native';
import { MediaCarousel } from './MediaCarousel';
import type { Media } from '../types';

const cover = { url: '/uploads/c.webp', width: 600, height: 800, blurhash: null };
function media(n: number): Media[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    type: 'IMAGE',
    url: `/uploads/${i}.webp`,
    thumbnailUrl: null,
    width: 600,
    height: 800,
    duration: null,
    blurhash: null,
    position: i,
  }));
}

describe('MediaCarousel', () => {
  it('rend une page par media', () => {
    render(<MediaCarousel media={media(3)} cover={cover} />);
    expect(screen.getAllByTestId('carousel-page')).toHaveLength(3);
  });

  it('affiche les points quand plusieurs medias', () => {
    render(<MediaCarousel media={media(3)} cover={cover} />);
    expect(screen.getByTestId('carousel-dots')).toBeTruthy();
  });

  it('masque les points pour un seul media', () => {
    render(<MediaCarousel media={media(1)} cover={cover} />);
    expect(screen.queryByTestId('carousel-dots')).toBeNull();
  });

  it('se replie sur la cover quand media est vide', () => {
    render(<MediaCarousel media={[]} cover={cover} />);
    expect(screen.getAllByTestId('carousel-page')).toHaveLength(1);
  });
});
