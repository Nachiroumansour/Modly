import { render, screen } from '@testing-library/react-native';
import { ProfileHero } from './ProfileHero';

describe('ProfileHero (M6)', () => {
  it('affiche expérience, prix et 3 stats', () => {
    render(
      <ProfileHero
        name="Awa Couture"
        avatarUrl="http://x/a.webp"
        coverUrl="http://x/c.webp"
        yearsExperience={8}
        priceMin={15000}
        stats={[
          { label: 'Modèles', value: 12 },
          { label: 'Abonnés', value: 340 },
          { label: "J'aime", value: 1200 },
        ]}
        specialties={['Mariage']}
      />,
    );
    expect(screen.getByText(/8 ans/i)).toBeTruthy();
    expect(screen.getByText(/15\s?000/)).toBeTruthy();
    expect(screen.getByText("J'aime")).toBeTruthy();
  });

  it('retombe sur l’initiale quand avatarUrl est absent', () => {
    render(<ProfileHero name="Boubacar" />);
    expect(screen.getByText('B')).toBeTruthy();
  });
});
