/** Borne les couvertures d'une collection a 1 a 4 tuiles pour la mosaique. */
export function mosaicSlots(urls: string[]): string[] {
  return urls.slice(0, 4);
}
