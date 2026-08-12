import { measureStringsFrom, parseMeasureValues } from './parse';

describe('parseMeasureValues', () => {
  it('convertit les champs valides en nombres', () => {
    const res = parseMeasureValues({ tourPoitrine: '95', tourTaille: '80' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.tourPoitrine).toBe(95);
      expect(res.payload.tourTaille).toBe(80);
    }
  });

  it('ignore les champs vides', () => {
    const res = parseMeasureValues({ tourPoitrine: '95', tourTaille: '  ' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.tourTaille).toBeUndefined();
    }
  });

  it('rejette une valeur hors bornes', () => {
    const res = parseMeasureValues({ tourPoitrine: '400' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/valeur invalide/);
  });

  it('rejette une valeur non numerique', () => {
    const res = parseMeasureValues({ tourPoitrine: 'abc' });
    expect(res.ok).toBe(false);
  });

  it('rejette un formulaire vide', () => {
    const res = parseMeasureValues({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/au moins une mesure/);
  });
});

describe('measureStringsFrom', () => {
  it('pre-remplit depuis des valeurs numeriques', () => {
    const v = measureStringsFrom({ tourPoitrine: 95, tourTaille: null });
    expect(v.tourPoitrine).toBe('95');
    expect(v.tourTaille).toBeUndefined();
  });

  it('renvoie vide pour null', () => {
    expect(measureStringsFrom(null)).toEqual({});
  });
});
