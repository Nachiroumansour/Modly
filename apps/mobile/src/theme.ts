/**
 * Design system Moodly — simple, premium, épuré.
 * Identité couleur resserrée : neutres + UNE seule couleur d'accent (terracotta,
 * clin d'œil aux textiles africains). Toujours passer par ces tokens, jamais de
 * couleur en dur dispersée dans les écrans.
 */

export const colors = {
  // Accent unique — identité de la marque.
  accent: '#C65D3B',
  accentSoft: '#F4E5DD',

  // Neutres — fond sombre (écrans immersifs façon TikTok) et clair (home Pinterest).
  ink: '#141414',
  inkElevated: '#1F1F1F',
  surface: '#FFFFFF',
  surfaceWarm: '#FAF8F5',

  // Texte.
  textPrimary: '#141414',
  textSecondary: '#6B6B6B',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#B4B0AB',

  // Traits & séparateurs.
  border: '#ECE9E4',

  // États.
  danger: '#C6483B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '500' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '500' },
} as const;

export const theme = { colors, spacing, radius, typography } as const;
export type Theme = typeof theme;
