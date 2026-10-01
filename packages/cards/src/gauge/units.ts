import { formatNumber, type EntityView, type HomeAssistant } from '@fluvy/core';

/**
 * Figures that are read together are written in ONE unit. Home Assistant lets every integration
 * choose its own (one string in W, the inverter in kW, the meter in MWh), so a value is first
 * brought to its base unit — W, Wh or VA — and the set is then displayed in the unit its largest
 * figure asks for: 3 200 W beside 250 W reads "3.2 kW" and "0.25 kW". Any other unit passes through.
 */

const SCALABLE = /^(m|k|M|G)?(Wh|W|VA)$/;
const PREFIX: Record<string, number> = { m: 0.001, k: 1e3, M: 1e6, G: 1e9 };

export interface Quantity {
  readonly value: number;
  readonly unit: string;
}

export interface Scale {
  readonly unit: string;
  readonly divisor: number;
}

/** The value in its base unit. `toBase(1, unit)` is the factor and the base unit of a whole series. */
export function toBase(value: number, unit: string): Quantity {
  const match = SCALABLE.exec(unit.trim());
  if (!match) return { value, unit };
  return { value: value * (PREFIX[match[1] ?? ''] ?? 1), unit: match[2] ?? unit };
}

/** An entity's reading in its base unit, or null when it has no usable number. */
export const baseOf = (view: EntityView): Quantity | null =>
  view.number === null ? null : toBase(view.number, view.unit);

/** The display unit for a set of base-unit figures: the largest one decides. */
export function scaleFor(peak: number, unit: string): Scale {
  const size = Math.abs(peak);
  if (!SCALABLE.test(unit)) return { unit, divisor: 1 };
  if (size >= 1e6) return { unit: `M${unit}`, divisor: 1e6 };
  if (size >= 1e3) return { unit: `k${unit}`, divisor: 1e3 };
  return { unit, divisor: 1 };
}

/** The number alone: three significant places at most (0.25 · 3.2 · 11.2 · 142), or the entity's own precision. */
export function figure(
  hass: HomeAssistant | undefined,
  value: number,
  scale: Scale,
  precision?: number,
): string {
  const shown = value / scale.divisor;
  const size = Math.abs(shown);
  const digits = precision ?? (size >= 100 ? 0 : size >= 1 ? 1 : 2);
  // a scaled figure keeps its one decimal (1.0 kW beside 2.2 kW; 0.4 and 0 stay as they are), as does a precision
  // the entity asks for
  const fixed = precision !== undefined || (scale.divisor > 1 && size >= 1 && size < 100);
  return formatNumber(hass, shown, { digits, ...(fixed ? { minDigits: digits } : {}) }).replace(
    /^-/,
    '−',
  ); // the design's minus, not a hyphen
}

/** "3.2 kW" for rows, tiles and legends that set value and unit in one run. */
export function figureText(
  hass: HomeAssistant | undefined,
  value: number,
  scale: Scale,
  precision?: number,
): string {
  const text = figure(hass, value, scale, precision);
  return scale.unit ? `${text} ${scale.unit}` : text;
}

/** A round ceiling just above a peak (2.9 → 3, 4 100 → 4 500, 46 → 50): the top of a scale nobody configured. */
export function ceilingFor(span: number): number {
  if (!(span > 0) || !Number.isFinite(span)) return 0;
  const step = 10 ** Math.floor(Math.log10(span)) / 2;
  return Math.ceil(span / step - 1e-9) * step;
}
