import { describe, expect, it } from 'vitest';
import type { TextRuler } from './fit.js';
import { pairFit } from './readout-pair.js';

/*
 * A readout each in equal columns (the Sensor card's several sensors, 1.6; the Chart card's series, #264): what gives
 * way, in order, as the row narrows.
 */

/** A ruler that measures a label at 10 a letter, a value with its unit at 14, 12 or 10 by its size (m, s, xs). */
const ruler = {
  width: (cls: string, text: string, ...unit: string[]): number =>
    (text + (unit[1] ?? '')).length * (cls.includes('--m') ? 14 : cls.includes('--s') ? 12 : 10),
} as unknown as TextRuler;

/** Three readouts: "INPUT" (50, and 20 for its key) over "245.3 V" (84 at m, 72 at s, 60 at xs). */
const THREE = Array.from({ length: 3 }, () => ({ label: 'INPUT', value: '245.3', unit: 'V' }));

describe('a row of readouts', () => {
  it('keeps the circles while every name and the small value hold beside one', () => {
    expect(pairFit(ruler, 500, THREE)).toEqual({ size: 'm', circles: true, gap: 32 });
    // a card that draws no circles starts without them
    expect(pairFit(ruler, 500, THREE, { circles: false })).toEqual({
      size: 'm',
      circles: false,
      gap: 32,
    });
  });

  it('gives way in order: the size at 32 apart, then the gap closes to 16, then a line each', () => {
    const fit = (width: number) => pairFit(ruler, width, THREE, { circles: false });
    expect(fit(316)).toEqual({ size: 'm', circles: false, gap: 32 });
    expect(fit(300)).toEqual({ size: 's', circles: false, gap: 32 });
    expect(fit(277)).toEqual({ size: 'xs', circles: false, gap: 32 });
    // a name and its key would not hold 32 apart: 16 apart, small
    expect(fit(260)).toEqual({ size: 's', circles: false, gap: 16 });
    expect(fit(230)).toEqual({ size: 's', circles: false, gap: 0 });
  });

  it('counts the columns of a line, not the readouts: four in two columns', () => {
    const four = [...THREE, ...THREE.slice(0, 1)];
    expect(pairFit(ruler, 260, four, { circles: false, columns: 2 })).toEqual({
      size: 'm',
      circles: false,
      gap: 32,
    });
    expect(pairFit(ruler, 260, four, { circles: false }).gap).toBe(0);
  });
});
