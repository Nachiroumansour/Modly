import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { storage } from '../src/lib/storage.js';
import { makeTestImage } from './helpers.js';

describe('stockage local des images', () => {
  it('sauvegarde une image et renvoie url + dimensions', async () => {
    const buffer = await makeTestImage(600, 800);
    const stored = await storage.save(buffer);
    expect(stored.width).toBe(600);
    expect(stored.height).toBe(800);
    expect(stored.url).toMatch(/\/uploads\/[\w-]+\.webp$/);
    const fileName = stored.url.split('/uploads/')[1];
    expect(existsSync(path.join(process.env.UPLOADS_DIR ?? './uploads', fileName))).toBe(true);
  });

  it("rejette un buffer qui n'est pas une image", async () => {
    await expect(storage.save(Buffer.from('pas une image'))).rejects.toThrow();
  });

  it('applique un filigrane quand demandé, sans casser url/dimensions', async () => {
    const buffer = await makeTestImage(600, 800);
    const stored = await storage.save(buffer, { watermark: '© Atelier Awa · Modly' });
    expect(stored.width).toBe(600);
    expect(stored.height).toBe(800);
    expect(stored.url).toMatch(/\/uploads\/[\w-]+\.webp$/);
    expect(stored.blurhash).toEqual(expect.any(String));
  });
});
