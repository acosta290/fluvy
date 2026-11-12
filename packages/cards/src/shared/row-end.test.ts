import { describe, expect, it } from 'vitest';
import type { TextRuler } from './fit.js';
import { fitValue, rowsKeepIcon, rowStacks, twoLines, valueCap, type ValueRow } from './row-end.js';

/** A ruler that lays every glyph 8 px wide; a pill adds its sides on the 4 grid, as `fitPills` does. */
const ruler = {
  width: (_cls: string, text: string) => text.length * 8,
  pill: (_cls: string, text: string, sides: number) => Math.ceil((text.length * 8 + sides) / 4) * 4,
} as unknown as TextRuler;

describe('a helpers or updates row whose end is never cut', () => {
  it('gives its circle first, then puts its end under its name (de "Installieren" at 211)', () => {
    // 171 − 68 − 128 ("Installieren" and its 32) leaves no room: the circles go; bare, 171 − 12 − 128 leaves 31,
    // under "Vacuum" (48): Install goes under the name
    const install = { name: 'Vacuum', button: 'Installieren' };
    expect(rowsKeepIcon(ruler, 171, [install])).toBe(false);
    expect(rowStacks(ruler, 171, install)).toBe(true);
    // "Run" (56) leaves 103 beside it: the row keeps its line
    expect(rowStacks(ruler, 171, { name: 'Vacuum', button: 'Run' })).toBe(false);
  });

  it('reads the line under the name too: a state in words goes under a sub it would squeeze', () => {
    // "Above horizon" (104) leaves 55 bare: "Sun" (24) holds, "Sets at 20:12" (104, held to 96) does not
    const sun = { name: 'Sun', end: 104 };
    expect(rowStacks(ruler, 171, sun)).toBe(false);
    expect(rowStacks(ruler, 171, { ...sun, sub: 'Sets at 20:12 · rises 07:48' })).toBe(true);
  });
});

/*
 * A value's pill is capped by the sheet (`rowEndStyles`): 68 % of the row less the circle's room, less the one gap once
 * the row gave its circle, on the 4 grid.
 */
describe("a value's pill and its cap", () => {
  it('mirrors the sheet: 68 % of the row less 68, less 12 once the row is bare, down to the 4 grid', () => {
    expect([171, 211, 266, 320].map((width) => valueCap(width, false))).toEqual([48, 72, 112, 148]);
    expect([171, 211, 266, 320].map((width) => valueCap(width, true))).toEqual([
      104, 128, 168, 204,
    ]);
  });
});

/*
 * A row that ends in a value's words (the entities card's): by measure, the value stands on one line, on two, or
 * under the row's words, so that nothing but the name is ever cut, and the name never to nothing.
 */
describe('a value in words and the row it ends', () => {
  const measure = (text: string): number => text.length * 8;
  /** A bare row of the card 152 wide (112 of content, 100 for the words and the value), no line under the name. */
  const row = (more: Partial<ValueRow>): ValueRow => ({
    row: 112,
    base: 100,
    name: 'Kitchen window',
    value: 'Open',
    cls: 'fv-row__value',
    least: 0,
    wraps: false,
    ...more,
  });

  it('measures a value’s two lines at its best break between its words', () => {
    expect(twoLines('Open', measure)).toBe(32);
    // "Not" / "detected"
    expect(twoLines('Not detected', measure)).toBe(64);
    // "Above the" / "horizon" (72), not "Above" / "the horizon" (88)
    expect(twoLines('Above the horizon', measure)).toBe(72);
  });

  it('keeps the value on one line while the name keeps its room: 96, or the name itself', () => {
    // 320 less the circle and the gap: the whole name beside "Open"
    expect(fitValue(ruler, row({ row: 320, base: 252 }))).toEqual({ stack: false, room: 220 });
    // a short name needs only itself: "TV" (16) holds beside "Detected" (64), in the 36 it leaves
    expect(fitValue(ruler, row({ name: 'TV', value: 'Detected' }))).toEqual({
      stack: false,
      room: 36,
    });
  });

  it('lets the name give way before the value moves: down to two letters and the ellipsis', () => {
    // "Kitchen window" (112) beside "Open" (32) in 100: the name has 68, cut as names may
    expect(fitValue(ruler, row({}))).toEqual({ stack: false, room: 68 });
    // beside "Locked" (48) it has 52; beside "Unlocked" (64) 36, under its 40: the value goes under the words
    expect(fitValue(ruler, row({ value: 'Locked' }))).toEqual({ stack: false, room: 52 });
    expect(fitValue(ruler, row({ value: 'Unlocked' }))).toEqual({ stack: true, room: 112 });
  });

  it('gives a state in words its two lines where one would cut the name short of its room', () => {
    // "Not home" (64) on one line leaves 36; "Not" / "home" (32) leaves 68: wrapped, the name has the rest
    expect(fitValue(ruler, row({ value: 'Not home', wraps: true }))).toEqual({
      stack: false,
      room: 68,
      width: 32,
    });
    // a figure and its unit never part: no second line to take
    expect(fitValue(ruler, row({ value: '21.6 °C' }))).toEqual({ stack: false, room: 44 });
    expect(fitValue(ruler, row({ value: '1,234.5 kWh' }))).toEqual({ stack: true, room: 112 });
  });

  it('puts the value under the words where even on two lines the name would be cut to nothing', () => {
    // "Не" / "обнаружено" (80) leaves 20 beside it
    expect(fitValue(ruler, row({ value: 'Не обнаружено', wraps: true }))).toEqual({
      stack: true,
      room: 112,
    });
    // a name shorter than the floor needs only itself: "TV" holds beside it
    expect(fitValue(ruler, row({ name: 'TV', value: 'Не обнаружено', wraps: true }))).toEqual({
      stack: false,
      room: 20,
      width: 80,
    });
  });

  it('keeps the line under the name its least form: the value moves before the line is cut', () => {
    // "Open" leaves 68: a line whose least form is 40 wide holds, one of 72 does not
    expect(fitValue(ruler, row({ least: 40 }))).toEqual({ stack: false, room: 68 });
    expect(fitValue(ruler, row({ least: 72 }))).toEqual({ stack: true, room: 112 });
    // …and a state in words takes its two lines for the line's sake too
    expect(fitValue(ruler, row({ value: 'Not home', wraps: true, least: 60 }))).toEqual({
      stack: false,
      room: 68,
      width: 32,
    });
  });

  it('draws a word the row would not hold under the words in the smaller sizes, by measure', () => {
    // each size's class is measured: 8 a letter at 16, 7 at 14, 6 at 12
    const sized = {
      width: (cls: string, text: string) =>
        text.length * (cls.endsWith('--xs') ? 6 : cls.endsWith('--s') ? 7 : 8),
    } as unknown as TextRuler;
    const word = (value: string) => fitValue(sized, row({ value }));
    expect(word('Заблокировано')).toEqual({ stack: true, room: 112 }); // 104
    expect(word('Воспроизведение')).toEqual({ stack: true, room: 112, size: 's' }); // 120, then 105
    expect(word('Разблокированными')).toEqual({ stack: true, room: 112, size: 'xs' }); // 136, 119, then 102
    // of a state in words, each word is held: the line breaks between them
    expect(fitValue(sized, row({ value: 'Не воспроизводится', wraps: true }))).toEqual({
      stack: true,
      room: 112,
      size: 's',
    });
  });
});
