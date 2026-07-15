import { render, screen } from '@testing-library/react-native';
import { ProfileHero } from './ProfileHero';

describe('ProfileHero', () => {
  it('affiche le nom', () => {
    render(<ProfileHero name="Atelier Awa" />);
    expect(screen.getByText('Atelier Awa')).toBeTruthy();
  });

  it('affiche les stats fournies', () => {
    render(
      <ProfileHero
        name="Atelier Awa"
        stats={[
          { label: 'Modeles', value: 8 },
          { label: 'Abonnes', value: 25 },
        ]}
      />,
    );
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Modeles')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('Abonnes')).toBeTruthy();
  });

  it('affiche bio et specialites quand fournies', () => {
    render(<ProfileHero name="Awa" bio="Bazin et broderie" specialties={['Mariage', 'Boubou']} />);
    expect(screen.getByText('Bazin et broderie')).toBeTruthy();
    expect(screen.getByText('Mariage')).toBeTruthy();
    expect(screen.getByText('Boubou')).toBeTruthy();
  });

  it('affiche le chip role quand fourni', () => {
    render(<ProfileHero name="Fatou" roleLabel="Client" />);
    expect(screen.getByText('Client')).toBeTruthy();
  });

  it('naffiche pas de stats quand non fournies', () => {
    render(<ProfileHero name="Awa" />);
    expect(screen.queryByText('Modeles')).toBeNull();
  });
});
