import { visibleTabs, centerTab } from './tabs';

describe('navigation tabs', () => {
  it('tailleur : Accueil · Rechercher · Publier(create) · Commandes · Profil', () => {
    expect(visibleTabs('TAILLEUR')).toEqual(['feed', 'search', 'create', 'orders', 'profile']);
  });

  it('client : Accueil · Rechercher · Sauvegardés · Commandes · Profil', () => {
    expect(visibleTabs('CLIENT')).toEqual(['feed', 'search', 'saved', 'orders', 'profile']);
  });

  it('sans compte : Accueil · Rechercher · Profil', () => {
    expect(visibleTabs(null)).toEqual(['feed', 'search', 'profile']);
  });

  it('onglet central : create pour tailleur, saved pour client, null sinon', () => {
    expect(centerTab('TAILLEUR')).toBe('create');
    expect(centerTab('CLIENT')).toBe('saved');
    expect(centerTab(null)).toBeNull();
  });

  it('le centre est toujours en 3e position (index 2) pour un rôle authentifié', () => {
    expect(visibleTabs('TAILLEUR')[2]).toBe(centerTab('TAILLEUR'));
    expect(visibleTabs('CLIENT')[2]).toBe(centerTab('CLIENT'));
  });
});
