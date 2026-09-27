import type { Hex } from '../types.js';
import { assertHex } from './oklch.js';

/** WCAG 2.1 §1.4.3 / §1.4.11 — implemented here so the gates are auditable. */

function channels(hex: Hex): readonly [number, number, number] {
  const value = Number.parseInt(assertHex(hex).slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function toHexByte(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

function linearize(channel8: number): number {
  const channel = channel8 / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: Hex): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: Hex, b: Hex): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Rounds a ratio the way the reports and the lab print it. */
export function roundRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

/**
 * Flattens `foreground` at `alpha` over `background`.
 *
 * Needed because HA stores theme values as opaque strings: "neutral ink at 70%"
 * has to ship pre-composited, not as `rgba()`.
 */
export function composite(foreground: Hex, background: Hex, alpha: number): Hex {
  const [fr, fg, fb] = channels(foreground);
  const [br, bg, bb] = channels(background);
  const mix = (f: number, b: number): string => toHexByte(f * alpha + b * (1 - alpha));
  return `#${mix(fr, br)}${mix(fg, bg)}${mix(fb, bb)}`;
}
