export const ROLES = ['TAILLEUR', 'CLIENT'] as const;
export type Role = (typeof ROLES)[number];

export const DESIGN_CATEGORIES = [
  'BOUBOU',
  'ROBE',
  'ENSEMBLE',
  'ENFANT',
  'MARIAGE',
  'TABASKI',
  'KORITE',
  'MAGAL',
] as const;
export type DesignCategory = (typeof DESIGN_CATEGORIES)[number];

export const POST_TYPES = ['INSPIRATION', 'ORIGINAL'] as const;
export type PostType = (typeof POST_TYPES)[number];

export const ORDER_STATUSES = [
  'EN_ATTENTE',
  'TISSU_RECU',
  'COUPE',
  'COUTURE',
  'FINITIONS',
  'PRET',
  'LIVREE',
  'ANNULEE',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['EN_ATTENTE', 'ACOMPTE', 'PAYE'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MEASUREMENT_FIELDS = [
  { key: 'tourPoitrine', label: 'Tour de poitrine' },
  { key: 'tourTaille', label: 'Tour de taille' },
  { key: 'tourHanches', label: 'Tour de hanches' },
  { key: 'largeurEpaules', label: "Largeur d'épaules" },
  { key: 'longueurBras', label: 'Longueur de bras' },
  { key: 'tourBras', label: 'Tour de bras' },
  { key: 'tourCou', label: 'Tour de cou' },
  { key: 'entrejambe', label: 'Entrejambe' },
  { key: 'longueurJambe', label: 'Longueur de jambe' },
  { key: 'longueurBoubou', label: 'Longueur de boubou' },
  { key: 'longueurChemise', label: 'Longueur de chemise' },
  { key: 'tourCuisse', label: 'Tour de cuisse' },
  { key: 'tourPoignet', label: 'Tour de poignet' },
  { key: 'carrureDos', label: 'Carrure dos' },
  { key: 'longueurManche', label: 'Longueur de manche' },
] as const;
export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]['key'];

export const MEASUREMENT_SOURCES = ['MANUELLE', 'IA'] as const;
export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number];
