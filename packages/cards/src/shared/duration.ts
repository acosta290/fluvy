/**
 * A span of time as a readout writes it: "45 min", "2 h 03 min", "3 d 7 h" — the largest two units, the smaller one
 * two digits wide beside an hour so a live figure keeps its width. Rounded to the minute, never up to a unit that
 * was not reached.
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
