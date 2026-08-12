import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { computeBlurhash } from './blurhash.js';
import { prisma } from './prisma.js';

type ReadImage = (url: string) => Promise<Buffer | null>;

/** Lit une image depuis UPLOADS_DIR à partir de son chemin relatif /uploads/x. */
const readFromDisk: ReadImage = async (url) => {
  const dir = path.resolve(process.env.UPLOADS_DIR ?? './uploads');
  const file = url.split('/uploads/')[1];
  if (!file) return null;
  try {
    return await readFile(path.join(dir, file));
  } catch {
    return null;
  }
};

/** Crée un Media (position 0) pour chaque Design sans média. Idempotent. */
export async function backfillDesignMedia(readImage: ReadImage = readFromDisk): Promise<number> {
  const designs = await prisma.design.findMany({
    where: { media: { none: {} } },
    select: { id: true, imageUrl: true, imageWidth: true, imageHeight: true },
  });
  let done = 0;
  for (const d of designs) {
    const buf = await readImage(d.imageUrl);
    const blurhash = buf ? await computeBlurhash(buf) : null;
    await prisma.$transaction([
      prisma.media.create({
        data: {
          designId: d.id,
          type: 'IMAGE',
          url: d.imageUrl,
          width: d.imageWidth,
          height: d.imageHeight,
          blurhash,
          position: 0,
        },
      }),
      prisma.design.update({ where: { id: d.id }, data: { coverBlurhash: blurhash, mediaCount: 1 } }),
    ]);
    done++;
  }
  return done;
}
