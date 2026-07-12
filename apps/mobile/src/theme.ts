/**
 * Design system Moodly — premium, épuré, éditorial (pas de look générique).
 * Neutres CHAUDS (noir chaud + ivoire) + une seule couleur d'accent terracotta.
 * Typo à caractère : Fraunces (serif éditoriale) pour la marque/titres, Manrope (grotesque) pour l'UI.
 * Toujours passer par ces tokens — jamais de couleur/police en dur ailleurs.
 */

export const colors = {
  // Accent unique — terracotta profond, maîtrisé.
  accent: '#BF572E',
  accentSoft: '#F0E1D6',

  // Neutres chauds — fonds sombre (écrans immersifs) et clair (home).
  ink: '#17120F',
  inkElevated: '#241C17',
  inkLine: '#33291F',
  surface: '#F6F1E9',
  surfaceWarm: '#FBF7F0',

  // Texte.
  textPrimary: '#1E1712',
  textSecondary: '#7A6E63',
  textOnDark: '#F6F1E9',
  textOnDarkMuted: '#A99C8E',

  border: '#E7DED2',
  danger: '#B23F2E',
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Manrope_500Medium',
  bodyRegular: 'Manrope_400Regular',
  bodyBold: 'Manrope_700Bold',
  bodyHeavy: 'Manrope_800ExtraBold',
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
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

/** Rôles typographiques : la fontFamily porte déjà la graisse (ne pas cumuler fontWeight). */
export const typography = {
  display: { fontFamily: fonts.displayBold, fontSize: 34 },
  title: { fontFamily: fonts.display, fontSize: 24 },
  heading: { fontFamily: fonts.bodyHeavy, fontSize: 18 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 16 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14 },
  caption: { fontFamily: fonts.body, fontSize: 12 },
} as const;

export const theme = { colors, fonts, spacing, radius, typography } as const;
export type Theme = typeof theme;
