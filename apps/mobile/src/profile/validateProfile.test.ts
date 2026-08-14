import { validateProfile } from './validateProfile';

describe('validateProfile', () => {
  it('rejette prix min > prix max', () => {
    expect(validateProfile({ priceMin: 20000, priceMax: 10000 })).toMatch(/prix minimum/i);
  });
  it('rejette une bio trop longue', () => {
    expect(validateProfile({ bio: 'x'.repeat(501) })).toMatch(/bio/i);
  });
  it('accepte une saisie valide', () => {
    expect(validateProfile({ bio: 'Bazin', priceMin: 10000, priceMax: 20000 })).toBeNull();
  });
});
