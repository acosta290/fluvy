import { localize, type HomeAssistant } from '@fluvy/core';
import { attachedUnit } from '@fluvy/ui';

/**
 * A span of time as a readout writes it: "45 min", "2 h 03 min", "3 d 7 h" — the largest two units, the smaller one
 * two digits wide beside an hour so a live figure keeps its width. Rounded to the minute, never up to a unit that
 * was not reached. The words and their join are the language's (`withUnit`): English keeps a space before a unit,
 * Japanese attaches it (45分, 2時間03分).
 */
export type DurationUnit = 'd' | 'h' | 'min';

export interface DurationPart {
  readonly value: string;
  readonly unit: DurationUnit;
}

export function durationParts(seconds: number): DurationPart[] | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return [{ value: String(minutes), unit: 'min' }];
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return [
      { value: String(hours), unit: 'h' },
      { value: String(minutes % 60).padStart(2, '0'), unit: 'min' },
    ];
  return [
    { value: String(Math.floor(hours / 24)), unit: 'd' },
    { value: String(hours % 24), unit: 'h' },
  ];
}

/** A duration unit's word in the house's language: "min", "h", "d" — 分, 時間, 日. */
export const unitWord = (hass: HomeAssistant | undefined, unit: DurationUnit): string =>
  localize(hass, unit === 'd' ? 'time.unit_d' : unit === 'h' ? 'time.unit_h' : 'time.unit_min');

/** The gap between a figure and its unit, as the unit's script writes it: a space ("12 min"), or none ("12分", no unit). */
export const unitGap = (unit: string): string => (!unit || attachedUnit(unit) ? '' : ' ');

/** A figure with its unit: "12 min", "2 h" — "12分", "2時間". */
export const withUnit = (value: string | number, unit: string): string =>
  `${value}${unitGap(unit)}${unit}`;

/** Figures with their units in a row: "2 h 10 min", "+1 h 15 min" — "2時間10分" (an attached unit takes no gap after it either). */
export const withUnits = (
  parts: ReadonlyArray<readonly [value: string | number, unit: string]>,
): string =>
  parts
    .map(([value, unit]) => withUnit(value, unit))
    .join(parts.some(([, unit]) => !unitGap(unit)) ? '' : ' ');

/**
 * A span as a readout says it, the last unit apart to sit in the unit slot: "2 h 10" and "min", "3 d 7" and "h" —
 * "2時間10" and "分"; "—" and nothing when it is not known.
 */
export function durationText(
  hass: HomeAssistant | undefined,
  seconds: number | null,
): { readonly value: string; readonly unit: string } {
  const parts = seconds === null ? null : durationParts(seconds);
  const last = parts?.[parts.length - 1];
  if (!parts || !last) return { value: '—', unit: '' };
  const lead = parts.slice(0, -1).map((part) => {
    const unit = unitWord(hass, part.unit);
    return `${withUnit(part.value, unit)}${unitGap(unit)}`;
  });
  return { value: `${lead.join('')}${last.value}`, unit: unitWord(hass, last.unit) };
}

/** A span in a line: "1 h 12 min" — "1時間12分"; "—" when it is not known. */
export const spanText = (hass: HomeAssistant | undefined, seconds: number | null): string => {
  const { value, unit } = durationText(hass, seconds);
  return unit ? withUnit(value, unit) : value;
};

/** The widest span a readout may show ("88 h 88" and "min" — "88時間88" and "分"), to lay a readout out by. */
export function widestDuration(hass: HomeAssistant | undefined): {
  readonly value: string;
  readonly unit: string;
} {
  const hours = unitWord(hass, 'h');
  return { value: `${withUnit('88', hours)}${unitGap(hours)}88`, unit: unitWord(hass, 'min') };
}
