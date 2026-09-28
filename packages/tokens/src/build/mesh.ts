import { fromHex, maxChroma, normalizeHue, toHex } from '../color/index.js';
import type { Hex, PaletteMode } from '../types.js';

/*
 * The view backgrounds' mesh: three radial stops over the page colour, in the page's own hue, and the same one
 * step deeper for a wall panel that is always on. The stops are the page moved in OKLCH by fixed offsets, read
 * off the approved Linen renders (design-lab/backgrounds): `mesh.test.ts` holds Linen to them within ΔE 2.
 */

/** An offset in OKLCH: lightness, chroma, hue (degrees). */
type Offset = readonly [dl: number, dc: number, dh: number];

const LIGHT: readonly Offset[] = [
  [0.0136, 0.009, -3.3],
  [-0.0265, 0.0129, 1.3],
  [0.0016, 0.0091, -3.3],
];
const DARK: readonly Offset[] = [
  [0.0915, 0.0065, -8.2],
  [0.0549, -0.0011, -6.3],
  [0.0695, 0.0046, -7.0],
];
/** The wall: the dark mesh one step deeper (the third value is the ground, not a stop). */
const WALL_DARK: readonly Offset[] = [
  [0.0386, 0.0015, -8.2],
  [0.02, -0.0021, -9.8],
  [-0.0054, -0.0043, -0.2],
];
/** In light mode a wall keeps the paper's stops, one step deeper (no approved render: a wall is judged in the dark). */
const WALL_LIGHT: readonly Offset[] = [
  [-0.0464, 0.009, -3.3],
  [-0.0865, 0.0129, 1.3],
  [-0.04, 0.0091, -3.3],
];

/** Under this chroma a page is grey: its mesh stays grey too, never tinted towards a hue it does not have. */
const ACHROMATIC = 0.004;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function stop(page: Hex, [dl, dc, dh]: Offset): Hex {
  const base = fromHex(page);
  const l = clamp(base.l + dl, 0, 1);
  const h = normalizeHue(base.h + dh);
  const c = base.c < ACHROMATIC ? 0 : clamp(base.c + dc, 0, maxChroma(l, h));
  return toHex({ l, c, h });
}

export interface Mesh {
  /** Three stops over the page. */
  readonly mesh: readonly [Hex, Hex, Hex];
  /** Two stops and the ground of the wall. */
  readonly wall: readonly [Hex, Hex, Hex];
}

/** The mesh of a page colour in a mode. */
export function meshOf(page: Hex, mode: PaletteMode): Mesh {
  const stops = (offsets: readonly Offset[]): [Hex, Hex, Hex] => [
    stop(page, offsets[0] as Offset),
    stop(page, offsets[1] as Offset),
    stop(page, offsets[2] as Offset),
  ];
  return mode === 'dark'
    ? { mesh: stops(DARK), wall: stops(WALL_DARK) }
    : { mesh: stops(LIGHT), wall: stops(WALL_LIGHT) };
}
