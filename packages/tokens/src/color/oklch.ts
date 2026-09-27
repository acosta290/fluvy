import type { Hex } from '../types.js';

/** Working colour. OKLCH keeps lightness perceptually even across hues. */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/;

/*
 * sRGB ↔ OKLCH without a colour library, because the palette engine also runs in the browser (the bundle
 * carries it). The formulas and constants are culori's, the library the palettes were designed with, so
 * every hex they ship stays the same to the bit — the palette snapshots prove it.
 */
interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const toLinear = (c: number): number => {
  const abs = Math.abs(c);
  return abs <= 0.04045 ? c / 12.92 : (Math.sign(c) || 1) * Math.pow((abs + 0.055) / 1.055, 2.4);
};

const fromLinear = (c: number): number => {
  const abs = Math.abs(c);
  return abs > 0.0031308
    ? (Math.sign(c) || 1) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055)
    : c * 12.92;
};

function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const a = c ? c * Math.cos((h / 180) * Math.PI) : 0;
  const b = c ? c * Math.sin((h / 180) * Math.PI) : 0;
  const L = Math.pow(l + 0.3963377773761749 * a + 0.2158037573099136 * b, 3);
  const M = Math.pow(l - 0.1055613458156586 * a - 0.0638541728258133 * b, 3);
  const S = Math.pow(l - 0.0894841775298119 * a - 1.2914855480194092 * b, 3);
  return {
    r: fromLinear(4.0767416360759574 * L - 3.3077115392580616 * M + 0.2309699031821044 * S),
    g: fromLinear(-1.2684379732850317 * L + 2.6097573492876887 * M - 0.3413193760026573 * S),
    b: fromLinear(-0.0041960761386756 * L - 0.7034186179359362 * M + 1.7076146940746117 * S),
  };
}

function rgbToOklch(rgb: Rgb): { l: number; c: number; h: number | undefined } {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const L = Math.cbrt(0.412221469470763 * r + 0.5363325372617348 * g + 0.0514459932675022 * b);
  const M = Math.cbrt(0.2119034958178252 * r + 0.6806995506452344 * g + 0.1073969535369406 * b);
  const S = Math.cbrt(0.0883024591900564 * r + 0.2817188391361215 * g + 0.6299787016738222 * b);
  const l = 0.210454268309314 * L + 0.7936177747023054 * M - 0.0040720430116193 * S;
  // a grey is exactly achromatic
  const grey = rgb.r === rgb.b && rgb.b === rgb.g;
  const a = grey ? 0 : 1.9779985324311684 * L - 2.4285922420485799 * M + 0.450593709617411 * S;
  const bb = grey ? 0 : 0.0259040424655478 * L + 0.7827717124575296 * M - 0.8086757549230774 * S;
  const c = Math.sqrt(a * a + bb * bb);
  return { l, c, h: c ? normalizeHue((Math.atan2(bb, a) * 180) / Math.PI) : undefined };
}

const displayable = ({ r, g, b }: Rgb): boolean =>
  r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;

/**
 * The colour itself when sRGB can show it; otherwise the most chroma sRGB holds at its lightness and hue,
 * found by bisection to 1/8192 of the OKLCH chroma range (0–0.4). If not even the grey fits (a lightness
 * out of range), its channels are clipped.
 */
function inGamut(color: Oklch): Rgb {
  const rgb = oklchToRgb(color);
  if (displayable(rgb)) return rgb;
  const grey = { ...color, c: 0 };
  const greyRgb = oklchToRgb(grey);
  if (!displayable(greyRgb)) {
    const clip = (v: number): number => Math.max(0, Math.min(v, 1));
    return { r: clip(greyRgb.r), g: clip(greyRgb.g), b: clip(greyRgb.b) };
  }
  let start = 0;
  let end = color.c;
  let good = 0;
  let c = 0;
  while (end - start > 0.4 / 8192) {
    c = start + (end - start) * 0.5;
    if (displayable(oklchToRgb({ ...color, c }))) {
      good = c;
      start = c;
    } else end = c;
  }
  const last = oklchToRgb({ ...color, c });
  return displayable(last) ? last : oklchToRgb({ ...color, c: good });
}

const channel = (value: number): number => Math.round(Math.max(0, Math.min(1, value || 0)) * 255);

export function isHex(value: string): boolean {
  return HEX_PATTERN.test(value);
}

export function assertHex(value: string): Hex {
  if (!isHex(value)) {
    throw new Error(`Expected a lowercase #rrggbb colour, received "${value}"`);
  }
  return value;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/**
 * OKLCH → `#rrggbb`. Chroma is gamut-mapped into sRGB first, so a requested
 * chroma that sRGB cannot hold degrades to the closest in-gamut colour instead of
 * clipping a channel and shifting hue.
 */
export function toHex(color: Oklch): Hex {
  const { r, g, b } = inGamut({
    l: clamp01(color.l),
    c: Math.max(0, color.c),
    h: normalizeHue(color.h),
  });
  return assertHex(
    `#${((1 << 24) | (channel(r) << 16) | (channel(g) << 8) | channel(b)).toString(16).slice(1)}`,
  );
}

function rgbOf(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Cannot parse colour "${hex}"`);
  const n = Number.parseInt(match[1] as string, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function fromHex(hex: string): Oklch {
  const { l, c, h } = rgbToOklch(rgbOf(hex));
  // an achromatic colour has no hue
  return { l, c, h: h ?? 0 };
}

/** `#rrggbb` → linear-light sRGB channels (0–1), with whether it is a grey (all three channels equal). */
export function linearRgb(hex: string): Rgb & { readonly grey: boolean } {
  const rgb = rgbOf(hex);
  return {
    r: toLinear(rgb.r),
    g: toLinear(rgb.g),
    b: toLinear(rgb.b),
    grey: rgb.r === rgb.g && rgb.g === rgb.b,
  };
}

export function withLightness(color: Oklch, l: number): Oklch {
  return { ...color, l: clamp01(l) };
}

export function withChroma(color: Oklch, c: number): Oklch {
  return { ...color, c: Math.max(0, c) };
}

/** Shortest-path hue interpolation, used to pull fixed semantic hues towards the accent. */
export function mixHue(from: number, to: number, amount: number): number {
  const a = normalizeHue(from);
  const b = normalizeHue(to);
  let delta = b - a;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return normalizeHue(a + delta * amount);
}

/** Smallest absolute angle between two hues, in degrees (0…180). */
export function hueDistance(a: number, b: number): number {
  const delta = Math.abs(normalizeHue(a) - normalizeHue(b));
  return delta > 180 ? 360 - delta : delta;
}

/** The most chroma sRGB can hold at this lightness and hue. */
export function maxChroma(l: number, h: number): number {
  return fromHex(toHex({ l, c: 0.5, h })).c;
}
