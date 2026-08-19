import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { watermarkBuffer } from '../src/lib/watermark.js';
import { makeTestImage } from './helpers.js';

describe('watermarkBuffer', () => {
  it('incruste un filigrane et conserve les dimensions', async () => {
    const src = await makeTestImage(600, 800);
    const out = await watermarkBuffer(src, '© Atelier Awa · Modly');
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(800);
    // Le rendu diffère de l'original (des pixels ont été modifiés).
    expect(out.equals(src)).toBe(false);
  });
});
