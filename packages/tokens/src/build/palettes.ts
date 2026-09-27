import { seedList } from '../palettes/index.js';
import type { Palette } from '../types.js';
import { derivePalette } from './derive.js';

/** All registered seeds, derived, in registry order. */
export function derivePalettes(): readonly Palette[] {
  return seedList.map(derivePalette);
}
