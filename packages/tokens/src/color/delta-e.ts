import type { Hex } from '../types.js';
import { linearRgb } from './oklch.js';

/*
 * CIEDE2000 without a colour library, because the palette engine also checks a custom palette in the browser.
 * The conversion (sRGB → XYZ D65 → CIELAB D65) and the formula are culori's `differenceCiede2000()`, the one
 * the palettes were tuned against: the colour tests hold the two equal.
 */
interface Lab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

const D65 = { x: 0.3127 / 0.329, y: 1, z: (1 - 0.3127 - 0.329) / 0.329 };
const EPSILON = Math.pow(6, 3) / Math.pow(29, 3);
const KAPPA = Math.pow(29, 3) / Math.pow(3, 3);
const f = (value: number): number =>
  value > EPSILON ? Math.cbrt(value) : (KAPPA * value + 16) / 116;

function lab(hex: Hex): Lab {
  const { r, g, b, grey } = linearRgb(hex);
  const x = f((0.4123907992659593 * r + 0.357584339383878 * g + 0.1804807884018343 * b) / D65.x);
  const y = f((0.2126390058715102 * r + 0.715168678767756 * g + 0.0721923153607337 * b) / D65.y);
  const z = f((0.0193308187155918 * r + 0.119194779794626 * g + 0.9505321522496607 * b) / D65.z);
  // a grey is exactly achromatic
  return { l: 116 * y - 16, a: grey ? 0 : 500 * (x - y), b: grey ? 0 : 200 * (y - z) };
}

const POW_25_7 = Math.pow(25, 7);
const TAU = 2 * Math.PI;

/** CIEDE2000 perceptual distance. Keeps the graph series, the device colours and the accent apart. */
export function deltaE(a: Hex, b: Hex): number {
  const std = lab(a);
  const smp = lab(b);
  const cAvg = (Math.hypot(std.a, std.b) + Math.hypot(smp.a, smp.b)) / 2;
  const g = 0.5 * (1 - Math.sqrt(Math.pow(cAvg, 7) / (Math.pow(cAvg, 7) + POW_25_7)));
  const apStd = std.a * (1 + g);
  const apSmp = smp.a * (1 + g);
  const cpStd = Math.hypot(apStd, std.b);
  const cpSmp = Math.hypot(apSmp, smp.b);
  const hueOf = (ap: number, bb: number): number => {
    const h = Math.abs(ap) + Math.abs(bb) === 0 ? 0 : Math.atan2(bb, ap);
    return h < 0 ? h + TAU : h;
  };
  const hpStd = hueOf(apStd, std.b);
  const hpSmp = hueOf(apSmp, smp.b);

  const dL = smp.l - std.l;
  const dC = cpSmp - cpStd;
  let dhp = cpStd * cpSmp === 0 ? 0 : hpSmp - hpStd;
  if (dhp > Math.PI) dhp -= TAU;
  if (dhp < -Math.PI) dhp += TAU;
  const dH = 2 * Math.sqrt(cpStd * cpSmp) * Math.sin(dhp / 2);

  const lp = (std.l + smp.l) / 2;
  const cp = (cpStd + cpSmp) / 2;
  let hp: number;
  if (cpStd * cpSmp === 0) hp = hpStd + hpSmp;
  else {
    hp = (hpStd + hpSmp) / 2;
    if (Math.abs(hpStd - hpSmp) > Math.PI) hp -= Math.PI;
    if (hp < 0) hp += TAU;
  }

  const lpm50 = Math.pow(lp - 50, 2);
  const t =
    1 -
    0.17 * Math.cos(hp - Math.PI / 6) +
    0.24 * Math.cos(2 * hp) +
    0.32 * Math.cos(3 * hp + Math.PI / 30) -
    0.2 * Math.cos(4 * hp - (63 * Math.PI) / 180);
  const sl = 1 + (0.015 * lpm50) / Math.sqrt(20 + lpm50);
  const sc = 1 + 0.045 * cp;
  const sh = 1 + 0.015 * cp * t;
  const deltaTheta =
    ((30 * Math.PI) / 180) * Math.exp(-Math.pow(((180 / Math.PI) * hp - 275) / 25, 2));
  const rc = 2 * Math.sqrt(Math.pow(cp, 7) / (Math.pow(cp, 7) + POW_25_7));
  const rt = -Math.sin(2 * deltaTheta) * rc;

  return Math.sqrt(
    Math.pow(dL / sl, 2) +
      Math.pow(dC / sc, 2) +
      Math.pow(dH / sh, 2) +
      ((rt * dC) / sc) * (dH / sh),
  );
}

/** Smallest CIEDE2000 distance in a set — the number that decides if a series is readable. */
export function minPairwiseDeltaE(colors: readonly Hex[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      const a = colors[i];
      const b = colors[j];
      if (a === undefined || b === undefined) continue;
      min = Math.min(min, deltaE(a, b));
    }
  }
  return Number.isFinite(min) ? min : 0;
}
