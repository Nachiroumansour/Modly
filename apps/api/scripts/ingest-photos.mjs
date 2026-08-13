// Ingestion de VRAIES photos dans la base dev : transforme un dossier de photos
// en vrais modeles (Design + Media), rattaches aux ateliers de demo existants.
// Meme mecanique que l'upload reel (sharp -> webp -> /uploads + blurhash).
//
// Idempotent : purge et recree les modeles issus de l'ingestion a chaque run.
//   --purge-gradients : supprime aussi les modeles-degrades de demo (/uploads/demo-*).
//
// Usage :
//   cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" node scripts/ingest-photos.mjs [--purge-gradients]
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/Users/macbook_1/devperso/Moodly';
const require = createRequire(`${ROOT}/`);
const sharp = require('sharp');
const { encode } = require('blurhash');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
dotenv.config({ path: `${ROOT}/apps/api/.env` });

const prisma = new PrismaClient();
const SRC = `${ROOT}/uploads/datasetTailleur`;
const UPLOADS = `${ROOT}/apps/api/uploads`;
const MAX_W = 1200; // largeur max servie (les photos sources sont plus grandes)

// Curation des 10 photos fournies : filename -> { title, category, atelier (phone) }.
// Toute photo non listee est ingeree en repli generique (titre auto, atelier round-robin).
const NDEYE = '+221770009999'; // Atelier Ndeye Couture (Mariage/Boubou/Bazin)
const FATOU = '+221770001111'; // Maison Fatou (Robe/Wax/Soiree)
const BAYE = '+221770002222'; // Baye Tailleur (Boubou/Tabaski/Homme)
const KORITE = '+221770003333'; // Atelier Korite (Enfant/Ensemble/Korite)

const CURATION = {
  'image.jpg': { title: 'Robe sirène brodée feuillage', category: 'ROBE', atelier: FATOU },
  '6dfb5399a18cbecbadbc69402d104a3a.jpg': { title: 'Robe sirène wax fuchsia', category: 'MARIAGE', atelier: NDEYE },
  '7c0c9eb66c3020b809dfcb25651a97af.jpg': { title: 'Robe perlée & gele orange', category: 'MARIAGE', atelier: NDEYE },
  'dc4e97f3495038a63d858a4ee74143ba.jpg': { title: 'Robe sirène wax spirale', category: 'ROBE', atelier: FATOU },
  'eb6686434ce043cf5862afe737abc734.jpg': { title: 'Robe brodée & volants wax', category: 'MARIAGE', atelier: NDEYE },
  'f4e0aa6f3355f38532521748b93f475b.jpg': { title: 'Robe ailée ankara rouge', category: 'ROBE', atelier: FATOU },
  '1157f2c2487ad6ee07ef76f5af5b91c1.jpg': { title: 'Ensemble cape bordeaux brodé', category: 'ENSEMBLE', atelier: BAYE },
  '840e3678ee770eecabbed79da43671a8.jpg': { title: 'Ensemble agbada kaki brodé', category: 'ENSEMBLE', atelier: BAYE },
  '9e5b748446714bb859e5b7650c1fb9d6.jpg': { title: 'Ensemble cape marron à pois', category: 'ENSEMBLE', atelier: BAYE },
  'beb691eec258c34becde0e12b57e37fa.jpg': { title: 'Chemise brodée camel', category: 'ENSEMBLE', atelier: KORITE },
};

const MARKER = '[photo-réelle]';
const FALLBACK_ATELIERS = [FATOU, NDEYE, BAYE, KORITE];
const IMG_RE = /\.(jpe?g|png|webp)$/i;

async function processPhoto(absPath) {
  const input = sharp(absPath).rotate(); // respecte l'orientation EXIF
  const webpBuf = await input.resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const meta = await sharp(webpBuf).metadata();
  const file = `real-${randomUUID()}.webp`;
  await writeFile(path.join(UPLOADS, file), webpBuf);
  const { data, info } = await sharp(webpBuf).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  return { url: `/uploads/${file}`, width: meta.width, height: meta.height, blurhash };
}

async function main() {
  const purgeGradients = process.argv.includes('--purge-gradients');
  await mkdir(UPLOADS, { recursive: true });

  // Ateliers cibles (par telephone) -> id.
  const tailors = await prisma.user.findMany({ where: { role: 'TAILLEUR' }, select: { id: true, phone: true, name: true } });
  const byPhone = new Map(tailors.map((t) => [t.phone, t]));
  if (!byPhone.has(FATOU)) {
    console.error('Ateliers de demo absents. Lance d’abord `npm run seed:demo`.');
    process.exit(1);
  }

  // Idempotence : supprime les modeles deja ingeres (marqueur en description).
  const del = await prisma.design.deleteMany({ where: { description: { contains: MARKER } } });
  if (del.count) console.log(`Purge ${del.count} modele(s) deja ingere(s).`);

  if (purgeGradients) {
    const g = await prisma.design.deleteMany({ where: { imageUrl: { startsWith: '/uploads/demo-' } } });
    console.log(`Purge ${g.count} modele(s)-degrade(s) de demo.`);
  }

  const files = (await readdir(SRC)).filter((f) => IMG_RE.test(f)).sort();
  if (files.length === 0) {
    console.error(`Aucune image dans ${SRC}`);
    process.exit(1);
  }

  let created = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const cur = CURATION[f] ?? {
      title: `Modèle ${i + 1}`,
      category: 'ROBE',
      atelier: FALLBACK_ATELIERS[i % FALLBACK_ATELIERS.length],
    };
    const tailor = byPhone.get(cur.atelier) ?? byPhone.get(FATOU);
    const m = await processPhoto(path.join(SRC, f));
    const likesCount = 8 + Math.floor(Math.random() * 52); // liveliness cosmetique

    await prisma.design.create({
      data: {
        tailorId: tailor.id,
        title: cur.title,
        category: cur.category,
        description: `${cur.title} — sur mesure par ${tailor.name}. ${MARKER}`,
        imageUrl: m.url,
        imageWidth: m.width,
        imageHeight: m.height,
        coverBlurhash: m.blurhash,
        mediaCount: 1,
        likesCount,
        media: { create: [{ type: 'IMAGE', url: m.url, width: m.width, height: m.height, blurhash: m.blurhash, position: 0 }] },
      },
    });
    created += 1;
    console.log(`+ ${cur.title}  (${cur.category}, ${tailor.name})`);
  }

  console.log(`\nOK : ${created} vrai(s) modele(s) ingere(s) depuis ${files.length} photo(s).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
