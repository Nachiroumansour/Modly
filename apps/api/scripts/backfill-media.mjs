import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url).pathname });
const { backfillDesignMedia } = await import('../src/lib/backfillMedia.ts');
const n = await backfillDesignMedia();
console.log(`Backfill média : ${n} design(s) traité(s).`);
process.exit(0);
