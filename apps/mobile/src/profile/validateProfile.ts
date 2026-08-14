import type { ProfileInput } from './hooks';

/** Miroir de `profileSchema` côté API. Renvoie un message FR ou `null` si valide. */
export function validateProfile(input: ProfileInput): string | null {
  if (input.bio != null && input.bio.length > 500) return 'La bio ne doit pas dépasser 500 caractères.';
  if (input.location != null && input.location.length > 120) return 'La localisation est trop longue.';
  if (input.yearsExperience != null && (input.yearsExperience < 0 || input.yearsExperience > 80))
    return "Les années d'expérience sont invalides.";
  if (input.priceMin != null && input.priceMin < 0) return 'Le prix minimum est invalide.';
  if (input.priceMax != null && input.priceMax < 0) return 'Le prix maximum est invalide.';
  if (input.priceMin != null && input.priceMax != null && input.priceMin > input.priceMax)
    return 'Le prix minimum doit être inférieur au prix maximum.';
  return null;
}
