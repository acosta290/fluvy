import { PALETTE_NAMES, type PaletteName } from '../config.js';
import type { PaletteSeed } from '../types.js';
import { clay } from './clay.seed.js';
import { dusk } from './dusk.seed.js';
import { blaze, flamingo, iris, mint, noir, volt } from './electric.seeds.js';
import { ember } from './ember.seed.js';
import { harbour } from './harbour.seed.js';
import { linen } from './linen.seed.js';
import { mist } from './mist.seed.js';
import { sage } from './sage.seed.js';
import { sand } from './sand.seed.js';
import { slate } from './slate.seed.js';

export const seeds: Readonly<Record<PaletteName, PaletteSeed>> = {
  sand,
  sage,
  mist,
  clay,
  slate,
  harbour,
  dusk,
  linen,
  ember,
  blaze,
  flamingo,
  iris,
  volt,
  mint,
  noir,
};

/** Seeds in registry order — the order the lab and the contact sheets present them in. */
export const seedList: readonly PaletteSeed[] = PALETTE_NAMES.map((name) => seeds[name]);

export function getSeed(name: PaletteName): PaletteSeed {
  return seeds[name];
}

export { clay, dusk, ember, harbour, linen, mist, sage, sand, slate };
export { blaze, flamingo, iris, mint, noir, volt };
