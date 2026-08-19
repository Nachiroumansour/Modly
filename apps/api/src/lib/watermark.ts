import sharp from 'sharp';

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

/**
 * Incruste un filigrane texte discret en bas-droite (p.ex. « © Atelier Awa · Modly »).
 * Taille de police proportionnelle à la largeur, opacité faible, léger contour noir
 * pour rester lisible sur fond clair comme foncé. Renvoie un PNG composé.
 */
export async function watermarkBuffer(buffer: Buffer, label: string): Promise<Buffer> {
  const image = sharp(buffer);
  const { width, height } = await image.metadata();
  if (!width || !height) return buffer;
  const fontSize = Math.max(12, Math.round(width * 0.035));
  const pad = Math.round(fontSize * 0.8);
  const strokeWidth = Math.max(1, Math.round(fontSize / 18));
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width - pad}" y="${height - pad}" text-anchor="end"
    font-family="sans-serif" font-size="${fontSize}"
    fill="#ffffff" fill-opacity="0.55"
    stroke="#000000" stroke-opacity="0.25" stroke-width="${strokeWidth}"
    paint-order="stroke">${escapeXml(label)}</text>
</svg>`;
  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
