import { API_URL, imageUri } from './config';

describe('imageUri', () => {
  it('préfixe un chemin relatif avec API_URL', () => {
    expect(imageUri('/uploads/x.webp')).toBe(`${API_URL}/uploads/x.webp`);
  });

  it('ajoute le slash manquant si besoin', () => {
    expect(imageUri('uploads/x.webp')).toBe(`${API_URL}/uploads/x.webp`);
  });

  it('laisse passer une URL absolue (rétro-compat / Cloudinary)', () => {
    expect(imageUri('https://res.cloudinary.com/x/y.webp')).toBe('https://res.cloudinary.com/x/y.webp');
    expect(imageUri('http://192.168.1.10:3000/uploads/z.webp')).toBe('http://192.168.1.10:3000/uploads/z.webp');
  });
});
