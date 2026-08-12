import { MEASUREMENT_FIELDS, type MeasurementKey } from '@moodly/shared';

export type MeasureStrings = Partial<Record<MeasurementKey, string>>;
export type ParseResult =
  | { ok: true; payload: Partial<Record<MeasurementKey, number>> }
  | { ok: false; error: string };

/** Valide et convertit les 15 champs saisis (chaine) en nombres 0 < x <= 300 cm. */
export function parseMeasureValues(values: MeasureStrings): ParseResult {
  const payload: Partial<Record<MeasurementKey, number>> = {};
  for (const f of MEASUREMENT_FIELDS) {
    const raw = values[f.key];
    if (raw == null || raw.trim() === '') continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > 300) {
      return { ok: false, error: `${f.label} : valeur invalide (entre 0 et 300 cm).` };
    }
    payload[f.key] = n;
  }
  if (Object.keys(payload).length === 0) {
    return { ok: false, error: 'Renseigne au moins une mesure.' };
  }
  return { ok: true, payload };
}

/** Pre-remplit les champs texte depuis des mesures numeriques existantes. */
export function measureStringsFrom(
  latest: Partial<Record<MeasurementKey, number | null>> | null,
): MeasureStrings {
  const v: MeasureStrings = {};
  if (!latest) return v;
  for (const f of MEASUREMENT_FIELDS) {
    const n = latest[f.key];
    if (n != null) v[f.key] = String(n);
  }
  return v;
}
