import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { decode } from 'blurhash';
import { computeBlurhash } from '../src/lib/blurhash.js';

describe('computeBlurhash', () => {
  it('produit un blurhash décodable pour une image', async () => {
    const buf = await sharp({
      create: { width: 100, height: 120, channels: 3, background: { r: 180, g: 90, b: 40 } },
    })
      .png()
      .toBuffer();
    const hash = await computeBlurhash(buf);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(6);
    // décodable sans lever
    expect(() => decode(hash, 32, 32)).not.toThrow();
  });
});
