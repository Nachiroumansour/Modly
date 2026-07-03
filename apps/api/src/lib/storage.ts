import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { ApiError } from './errors.js';

export type StoredImage = { url: string; width: number; height: number };

export interface ImageStorage {
  save(buffer: Buffer): Promise<StoredImage>;
}

class LocalDiskStorage implements ImageStorage {
  constructor(
    private baseUrl: string,
    private dir: string,
  ) {}

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
    return { url: `${this.baseUrl}/uploads/${fileName}`, width, height };
  }
}

class CloudinaryStorage implements ImageStorage {
  async save(buffer: Buffer): Promise<StoredImage> {
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
    return { url: result.secure_url, width: result.width, height: result.height };
  }
}

function createStorage(): ImageStorage {
  if (process.env.CLOUDINARY_URL) {
    return new CloudinaryStorage();
  }
  const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const dir = path.resolve(process.env.UPLOADS_DIR ?? './uploads');
  return new LocalDiskStorage(baseUrl, dir);
}

export const storage: ImageStorage = createStorage();
