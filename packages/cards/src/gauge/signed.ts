/**
 * The signed gauge: a value that can be negative (a grid meter) on 41 ticks over 270° with zero at the top — the
 * left side from `min` to zero, the right side from zero to `max`, each its own scale — lit from zero to the value.
 * At 320 it is the approved drawing: R 104 about (160, 124), majors 16 and minors 8, the ends' words beside the
 * ring's feet, 220 tall. Narrower, the ring shrinks to the column and the ends' words go under its feet.
 */

export const TICKS = 40;
/** Degrees each side of the top. */
export const SWEEP = 135;
const R_MAX = 104;
const COS45 = Math.SQRT1_2;

const down4 = (v: number): number => Math.floor(v / 4) * 4;
const up4 = (v: number): number => Math.ceil(v / 4) * 4;

export interface SignedGeometry {
  readonly width: number;
  readonly height: number;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly major: number;
  readonly minor: number;
  /** Where the ends' words start (their top). */
  readonly endsTop: number;
  /** The ends' words from the column's edges: beside the ring's feet, or at the edges under them. */
  readonly endsLeft: number;
  readonly endsRight: number;
}

/** The drawing for a column `width` whose ends' words are `endWidth` wide (the wider of the two). */
export function signedGeometry(width: number, endWidth: number): SignedGeometry {
  const cx = Math.floor(width / 2);
  // beside the feet: the words end 2 px before the outermost tick's end
  const beside = down4(Math.min(R_MAX, (cx - 2 - endWidth) / COS45, cx - 2));
  const under = beside < 72;
  const r = under ? down4(Math.min(R_MAX, cx - 2)) : beside;
  const cy = r + 20;
  const foot = r * COS45;
  const endsTop = under ? up4(cy + foot + 4) : down4(cy + foot);
  const major = r >= 88 ? 16 : 12;
  return {
    width,
    height: endsTop + 24,
    cx,
    cy,
    r,
    major,
    minor: major / 2,
    endsTop,
    endsLeft: under ? 0 : Math.max(0, down4(cx - foot - 2 - endWidth)),
    endsRight: under ? 0 : Math.max(0, down4(width - cx - foot - 2 - endWidth)),
  };
}

/** Where a value sits on the ring: −1 at `min`, 0 at zero, 1 at `max`. */
export function fractionOf(value: number, min: number, max: number): number {
  if (value < 0) return min < 0 ? Math.max(-1, value / -min) : -1;
  return max > 0 ? Math.min(1, value / max) : 1;
}

export interface Tick {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly lit: boolean;
}

const on = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

/** Every tick, lit from zero to `fraction` (the zero tick with it); none lit when the value is unknown. */
export function ticksOf(g: SignedGeometry, fraction: number | null): Tick[] {
  const out: Tick[] = [];
  for (let i = 0; i <= TICKS; i++) {
    const f = -1 + (2 * i) / TICKS;
    const deg = f * SWEEP - 90;
    const len = i % 10 === 0 ? g.major : g.minor;
    const [x1, y1] = on(g.cx, g.cy, g.r, deg);
    const [x2, y2] = on(g.cx, g.cy, g.r - len, deg);
    const lit =
      fraction !== null &&
      (i === TICKS / 2 ||
        (fraction < 0 && f <= 0 && f >= fraction - 1e-9) ||
        (fraction > 0 && f >= 0 && f <= fraction + 1e-9));
    out.push({ x1, y1, x2, y2, lit });
  }
  return out;
}

export type ValueSize = 'l' | 'm';

/** The value's line (and the label's over it) for a size: 40/44 under an 11/16 label, or 24/28. */
export function valueBox(g: SignedGeometry, size: ValueSize): { label: number; value: number } {
  return size === 'l'
    ? { label: g.cy - 36, value: g.cy - 20 }
    : { label: g.cy - 28, value: g.cy - 12 };
}

/** The chord of the ticks' inner edge (4 px clear of it) `dy` above or below the centre. */
const chord = (g: SignedGeometry, dy: number): number => {
  const inner = g.r - g.major - 4;
  return inner > dy ? 2 * Math.sqrt(inner * inner - dy * dy) : 0;
};

/** The room inside the ring on the value's line. */
export function valueRoom(g: SignedGeometry, size: ValueSize): number {
  const box = valueBox(g, size);
  return chord(g, Math.max(g.cy - box.value, box.value + (size === 'l' ? 44 : 28) - g.cy));
}

/** The room inside the ring on the label's line, in whole even pixels (the label is centred on the ring). */
export function labelRoom(g: SignedGeometry, size: ValueSize): number {
  return Math.floor(chord(g, g.cy - valueBox(g, size).label) / 2) * 2;
}
