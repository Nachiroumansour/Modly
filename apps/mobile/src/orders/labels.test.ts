import { formatPrice, nextStatus, progress, STATUS_LABELS } from './labels';

describe('labels commandes', () => {
  it('donne le statut suivant dans la chaîne', () => {
    expect(nextStatus('EN_ATTENTE')).toBe('TISSU_RECU');
    expect(nextStatus('FINITIONS')).toBe('PRET');
    expect(nextStatus('PRET')).toBe('LIVREE');
  });

  it('n’a pas de suivant sur un statut terminal', () => {
    expect(nextStatus('LIVREE')).toBeNull();
    expect(nextStatus('ANNULEE')).toBeNull();
  });

  it('calcule une progression croissante puis pleine à la livraison', () => {
    expect(progress('EN_ATTENTE')).toBe(0);
    expect(progress('LIVREE')).toBe(1);
    expect(progress('COUPE')).toBeGreaterThan(0);
    expect(progress('COUPE')).toBeLessThan(1);
  });

  it('formate le prix en FCFA et gère l’absence de prix', () => {
    expect(formatPrice(null)).toBe('Prix à définir');
    expect(formatPrice(25000).replace(/ | /g, ' ')).toBe('25 000 FCFA');
  });

  it('a un libellé français pour chaque statut', () => {
    expect(STATUS_LABELS.EN_ATTENTE).toBe('En attente');
    expect(STATUS_LABELS.LIVREE).toBe('Livrée');
  });
});
