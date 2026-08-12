import { encode } from 'blurhash';
import sharp from 'sharp';

/** Placeholder flou compact (façon Insta/Pinterest), calculé depuis les pixels. */
export async function computeBlurhash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}
