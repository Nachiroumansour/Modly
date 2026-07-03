import { describe, expect, it } from 'vitest';
import {
  DESIGN_CATEGORIES,
  MEASUREMENT_FIELDS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  ROLES,
} from './index.js';

describe('constantes partagées Moodly', () => {
  it('définit exactement 15 mesures avec des clés uniques et des libellés français', () => {
    expect(MEASUREMENT_FIELDS).toHaveLength(15);
    const keys = MEASUREMENT_FIELDS.map((m) => m.key);
    expect(new Set(keys).size).toBe(15);
    for (const field of MEASUREMENT_FIELDS) {
      expect(field.label.length).toBeGreaterThan(2);
    }
  });

  it('définit les rôles, catégories et statuts du cahier des charges', () => {
    expect(ROLES).toEqual(['TAILLEUR', 'CLIENT']);
    expect(DESIGN_CATEGORIES).toHaveLength(8);
    expect(DESIGN_CATEGORIES).toContain('TABASKI');
    expect(ORDER_STATUSES).toEqual([
      'EN_ATTENTE',
      'TISSU_RECU',
      'COUPE',
      'COUTURE',
      'FINITIONS',
      'PRET',
      'LIVREE',
      'ANNULEE',
    ]);
    expect(PAYMENT_STATUSES).toEqual(['EN_ATTENTE', 'ACOMPTE', 'PAYE']);
  });
});
