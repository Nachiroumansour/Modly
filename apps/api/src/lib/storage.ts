import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { ApiError } from './errors.js';
import { computeBlurhash } from './blurhash.js';

export type StoredImage = { url: string; width: number; height: number; blurhash: string };

export interface ImageStorage {
  save(buffer: Buffer): Promise<StoredImage>;
}

class LocalDiskStorage implements ImageStorage {
  constructor(private dir: string) {}

  async save(buffer: Buffer): Promise<StoredImage> {
    let width: number | undefined;
    let height: number | undefined;
    let webp: Buffer;
    try {
      const image = sharp(buffer);
      ({ width, height } = await image.metadata());
      webp = await image.webp({ quality: 82 }).toBuffer();
    } catch {
      throw new ApiError(400, 'IMAGE_INVALIDE', 'Impossible de lire cette image.');
    }
    if (!width || !height) {
      throw new ApiError(400, 'IMAGE_INVALIDE', 'Impossible de lire cette image.');
    }
    const fileName = `${randomUUID()}.webp`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, fileName), webp);
    const blurhash = await computeBlurhash(buffer);
    // Chemin relatif : l'app le préfixe avec l'URL de l'API qu'elle détecte.
    // Ainsi les images ne cassent pas quand l'IP LAN change.
    return { url: `/uploads/${fileName}`, width, height, blurhash };
  }
}

class CloudinaryStorage implements ImageStorage {
  async save(buffer: Buffer): Promise<StoredImage> {
    const blurhash = await computeBlurhash(buffer);
    const result = await new Promise<{ secure_url: string; width: number; height: number }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: 'moodly/designs' }, (err, res) => {
            if (err || !res) reject(err ?? new Error('Réponse Cloudinary vide'));
            else resolve(res);
          })
          .end(buffer);
      },
    );
    return { url: result.secure_url, width: result.width, height: result.height, blurhash };
  }
}

function createStorage(): ImageStorage {
  if (process.env.CLOUDINARY_URL) {
    return new CloudinaryStorage();
  }
  const dir = path.resolve(process.env.UPLOADS_DIR ?? './uploads');
  return new LocalDiskStorage(dir);
}

export const storage: ImageStorage = createStorage();
