// Enrichit la base dev avec des comptes tailleur riches (profils + posts multi-images
// + engagement) et des clients, pour une demo credible. Idempotent (recree les comptes
// de demo a chaque run). Images = degrades premium generes (pas de vraies photos :
// pas d'acces externe / droits). Video = differee au lecteur reels (MVP3).
//
// Usage : cd apps/api && PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH" node scripts/seed-demo.mjs
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire('/Users/macbook_1/devperso/Moodly/');
const sharp = require('sharp');
const { encode } = require('blurhash');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
dotenv.config({ path: '/Users/macbook_1/devperso/Moodly/apps/api/.env' });

const prisma = new PrismaClient();
const UPLOADS = '/Users/macbook_1/devperso/Moodly/apps/api/uploads';

const PALETTES = [
  ['#2E2350', '#5B3A9E'], ['#7A5B12', '#C79A2E'], ['#1E4A5F', '#2E7D95'],
  ['#7A2E1B', '#BF572E'], ['#4A1730', '#8E2A55'], ['#20402A', '#3E7A50'],
  ['#3A2718', '#7A5230'], ['#12314A', '#2E5E8E'], ['#5A1E1E', '#9E3A34'],
  ['#603A12', '#B5852E'], ['#123A34', '#2E7A6A'], ['#2A2A38', '#4E4E6A'],
];
const RATIOS = [[600, 800], [600, 900], [600, 760], [600, 1000], [600, 720], [600, 680]];

function svg(w, h, [c1, c2], seed) {
  const angle = (seed * 37) % 360;
  const hx = 20 + ((seed * 53) % 60);
  const hy = 15 + ((seed * 29) % 50);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>
    <radialGradient id="h" cx="${hx}%" cy="${hy}%" r="70%"><stop offset="0%" stop-color="#fff" stop-opacity="0.18"/><stop offset="60%" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs><rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#h)"/></svg>`;
}

let counter = 0;
async function makeMedia() {
  counter += 1;
  const [w, h] = RATIOS[counter % RATIOS.length];
  const pal = PALETTES[counter % PALETTES.length];
  const webp = await sharp(Buffer.from(svg(w, h, pal, counter))).webp({ quality: 82 }).toBuffer();
  const file = `demo-${randomUUID()}.webp`;
  await writeFile(path.join(UPLOADS, file), webp);
  const { data, info } = await sharp(webp).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  return { url: `/uploads/${file}`, width: w, height: h, blurhash };
}

const ATELIERS = [
  { phone: '+221770009999', name: 'Atelier Ndeye Couture', bio: 'Haute couture wax et bazin. Sur mesure a Dakar depuis 2015.', location: 'Dakar, Plateau', specialties: ['Mariage', 'Boubou', 'Bazin'], verified: true,
    designs: [['Boubou brode or', 'BOUBOU', 3], ['Robe de mariee wax', 'MARIAGE', 4], ['Grand boubou fete', 'BOUBOU', 2], ['Ensemble bazin riche', 'ENSEMBLE', 1], ['Tenue Korite', 'KORITE', 3], ['Robe cocktail moderne', 'ROBE', 2]] },
  { phone: '+221770001111', name: 'Maison Fatou', bio: 'Robes et ensembles contemporains. Coupe precise, tissus nobles.', location: 'Dakar, Almadies', specialties: ['Robe', 'Wax', 'Soiree'], verified: true,
    designs: [['Robe wax structuree', 'ROBE', 2], ['Ensemble tailleur femme', 'ENSEMBLE', 3], ['Robe longue Tabaski', 'TABASKI', 1], ['Combinaison chic', 'ROBE', 2], ['Boubou moderne femme', 'BOUBOU', 4]] },
  { phone: '+221770002222', name: 'Baye Tailleur', bio: 'Boubous homme et tenues traditionnelles. Thies.', location: 'Thies', specialties: ['Boubou', 'Tabaski', 'Homme'], verified: false,
    designs: [['Boubou homme Tabaski', 'TABASKI', 2], ['Grand boubou brode', 'BOUBOU', 1], ['Ensemble Magal', 'MAGAL', 3], ['Tenue enfant fete', 'ENFANT', 2], ['Boubou trois pieces', 'BOUBOU', 1]] },
  { phone: '+221770003333', name: 'Atelier Korite', bio: 'Ensembles famille et tenues enfant pour les grandes fetes.', location: 'Saint-Louis', specialties: ['Enfant', 'Ensemble', 'Korite'], verified: false,
    designs: [['Ensemble famille Korite', 'KORITE', 4], ['Tenue enfant wax', 'ENFANT', 2], ['Robe fillette', 'ENFANT', 1], ['Ensemble pere-fils', 'ENSEMBLE', 2]] },
];

const CLIENTS = [
  { phone: '+221770005555', name: 'Awa' },
  { phone: '+221770006666', name: 'Moussa' },
  { phone: '+221770007777', name: 'Aida' },
];

const COMMENTS = ['Magnifique !', 'J adore la coupe', 'Trop belle cette tenue', 'Combien pour ce modele ?', 'Le tissu est superbe', 'Parfait pour la Tabaski'];
const COLLECTION_NAMES = ['Mariage', 'Boubous', 'A commander'];

function pick(arr, n) {
  const c = [...arr];
  const out = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
  return out;
}

async function main() {
  const allPhones = [...ATELIERS.map((a) => a.phone), ...CLIENTS.map((c) => c.phone)];
  await prisma.user.deleteMany({ where: { phone: { in: allPhones } } });
  // Purge des comptes de test qui ont pu fuiter dans la base dev (helper registerUser
  // = 'Mamadou'/'Fatou' ; quelques comptes de test manuels). Ne touche pas aux vrais comptes.
  await prisma.user.deleteMany({
    where: {
      OR: [
        { name: { in: ['Mamadou', 'Fatou'] } },
        { phone: { in: ['+221772223344', '+221773334455', '+221774440002', '+221771112233'] } },
      ],
    },
  });
  await mkdir(UPLOADS, { recursive: true });
  const hash = bcrypt.hashSync('secret123', 10);

  const tailorIds = [];
  const allDesignIds = [];

  for (const a of ATELIERS) {
    const user = await prisma.user.create({
      data: {
        phone: a.phone, name: a.name, role: 'TAILLEUR', passwordHash: hash,
        tailorProfile: { create: { bio: a.bio, location: a.location, specialties: a.specialties, verified: a.verified, yearsExperience: 5 } },
      },
    });
    tailorIds.push(user.id);
    for (const [title, category, nImages] of a.designs) {
      const media = [];
      for (let i = 0; i < nImages; i++) media.push(await makeMedia());
      const cover = media[0];
      const d = await prisma.design.create({
        data: {
          tailorId: user.id, title, category, description: `${title} — sur mesure par ${a.name}.`,
          imageUrl: cover.url, imageWidth: cover.width, imageHeight: cover.height,
          coverBlurhash: cover.blurhash, mediaCount: media.length,
          media: { create: media.map((m, i) => ({ type: 'IMAGE', url: m.url, width: m.width, height: m.height, blurhash: m.blurhash, position: i })) },
        },
      });
      allDesignIds.push(d.id);
    }
  }

  const clientIds = [];
  for (const c of CLIENTS) {
    const u = await prisma.user.create({ data: { phone: c.phone, name: c.name, role: 'CLIENT', passwordHash: hash } });
    clientIds.push(u.id);
  }

  // Engagement
  const likeCount = {};
  const commentCount = {};
  const bookmarkCount = {};
  for (const clientId of clientIds) {
    // suit 2-3 ateliers
    for (const tid of pick(tailorIds, 2 + Math.floor(Math.random() * 2))) {
      await prisma.follow.create({ data: { followerId: clientId, tailorId: tid } }).catch(() => {});
    }
    // like ~40% des modeles
    for (const did of allDesignIds) {
      if (Math.random() < 0.4) {
        await prisma.like.create({ data: { userId: clientId, designId: did } }).catch(() => {});
        likeCount[did] = (likeCount[did] || 0) + 1;
      }
    }
    // commente quelques modeles
    for (const did of pick(allDesignIds, 3)) {
      await prisma.comment.create({ data: { userId: clientId, designId: did, text: COMMENTS[Math.floor(Math.random() * COMMENTS.length)] } });
      commentCount[did] = (commentCount[did] || 0) + 1;
    }
    // collections + enregistrements
    const cols = [];
    for (const name of pick(COLLECTION_NAMES, 2)) {
      const col = await prisma.collection.create({ data: { userId: clientId, name } });
      cols.push(col.id);
    }
    for (const did of pick(allDesignIds, 5)) {
      const collectionId = Math.random() < 0.7 ? cols[Math.floor(Math.random() * cols.length)] : null;
      await prisma.bookmark.create({ data: { userId: clientId, designId: did, collectionId } }).catch(() => {});
      bookmarkCount[did] = (bookmarkCount[did] || 0) + 1;
    }
  }

  // Recale les compteurs denormalises
  for (const did of allDesignIds) {
    await prisma.design.update({
      where: { id: did },
      data: { likesCount: likeCount[did] || 0, commentsCount: commentCount[did] || 0, bookmarksCount: bookmarkCount[did] || 0 },
    });
  }

  console.log(`OK : ${ATELIERS.length} ateliers, ${allDesignIds.length} modeles (multi-images), ${CLIENTS.length} clients, engagement seede.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
