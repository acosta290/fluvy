import { describe, expect, it } from 'vitest';
import type { TextRuler } from './fit.js';
import { readoutsRow, statsRow, type GivingStat, type StatText } from './readouts.js';

/** A stand-in for the card's ruler: a label's letters at 7, a figure's (and its unit's) at 11 at s and 9 at xs. */
const ruler = {
  width(cls: string, text: string, _unitCls?: string, unit = ''): number {
    if (cls.includes('fv-readout__label')) return text.length * 7;
    const pace = cls.includes('fv-readout--xs') ? 9 : 11;
    return (text.length + unit.length) * pace;
  },
} as unknown as TextRuler;

/** The EV charger's three, in German: "Von der Sonne" is the widest at 91. */
const SESSION: StatText[] = [
  { label: 'Geladen', value: '12,4', unit: 'kWh' },
  { label: 'Seit', value: '1 h 5', unit: 'min' },
  { label: 'Von der Sonne', value: '96', unit: '%' },
];

describe('statsRow', () => {
  it('gives every statistic its column while the widest holds in it', () => {
    // 320: three columns of 96
    expect(statsRow(ruler, 320, SESSION)).toEqual({ columns: 3, size: 's', odd: false });
  });

  it('takes fewer columns, the last row taking the whole row, before a word wraps onto its figure', () => {
    // 284: three columns of 84 do not hold "Von der Sonne" (91); two of 134 do — two and one
    expect(statsRow(ruler, 284, SESSION)).toEqual({ columns: 2, size: 's', odd: true });
    expect(statsRow(ruler, 284, SESSION.slice(0, 2))).toEqual({
      columns: 2,
      size: 's',
      odd: false,
    });
  });

  it('holds a shorter last row’s one readout to the whole row: two and one before one a line', () => {
    // a gauge's three in half a column (112): "Average" (49) is wider than a half (48), but it is the one that takes
    // the whole row; the two above it hold their halves at xs (45)
    const gauge: StatText[] = [
      { label: 'Min', value: '0.4', unit: 'kW' },
      { label: 'Max', value: '4.1', unit: 'kW' },
      { label: 'Average', value: '1.4', unit: 'kW' },
    ];
    expect(statsRow(ruler, 112, gauge)).toEqual({ columns: 2, size: 'xs', odd: true });
    // one of the two above it would not: one a line
    const wider = gauge.map((stat) => (stat.label === 'Max' ? { ...stat, value: '14.1' } : stat));
    expect(statsRow(ruler, 112, wider)).toEqual({ columns: 1, size: 's', odd: false });
  });

  it('stands one a line where not even two hold', () => {
    expect(statsRow(ruler, 150, SESSION)).toEqual({ columns: 1, size: 's', odd: false });
  });

  it('takes the size the widest figure fits its column at', () => {
    // "2 h 10" with its unit is 99 at s: three columns of 96 hold it at xs (81)
    const longer = SESSION.map((stat) =>
      stat.label === 'Seit' ? { ...stat, value: '2 h 10' } : stat,
    );
    expect(statsRow(ruler, 320, longer)).toEqual({ columns: 3, size: 'xs', odd: false });
  });
});

/**
 * A room's three, in Dutch (#159): "Temperatuur" and "Vochtigheid" are 77; the figures are 66, 33 and 66 at s, 54, 27
 * and 54 at xs, and 45, 27 and 27 at xs in their short form ("17,4°", "3/9").
 */
const ROOM: GivingStat[] = [
  {
    label: 'Temperatuur',
    value: '17,4',
    unit: '°C',
    short: { value: '17,4', unit: '°', tight: true },
  },
  { label: 'Vochtigheid', value: '51', unit: '%' },
  { label: 'Aan', value: '3', unit: 'van 9', short: { value: '3/9' } },
];
const whole = { columns: 3, size: 's', odd: false, labels: 'words', short: false };

describe('readoutsRow', () => {
  it('keeps the words and the figures whole where every one holds its third', () => {
    // 320: thirds of 96
    expect(readoutsRow(ruler, 320, ROOM)).toEqual(whole);
  });

  it('stays one row as it narrows, what does not hold giving way in order: the words, the size, the units', () => {
    // 260: thirds of 76 do not hold a word of 77 — their icons, the figures as they were
    expect(readoutsRow(ruler, 260, ROOM)).toEqual({ ...whole, labels: 'icons' });
    // 224: thirds of 64 do not hold a figure of 66 at s — the smaller size (54)
    expect(readoutsRow(ruler, 224, ROOM)).toEqual({ ...whole, labels: 'icons', size: 'xs' });
    // 180: thirds of 49 do not hold 54 — the short form (45)
    expect(readoutsRow(ruler, 180, ROOM)).toEqual({
      ...whole,
      labels: 'icons',
      size: 'xs',
      short: true,
    });
  });

  it('lets the columns give way only where the shortest figures would not hold, never a cut one', () => {
    // 150: thirds of 39 do not hold "17,4°" (45) — two and one, and in halves of 67 the figures are whole again
    expect(readoutsRow(ruler, 150, ROOM)).toEqual({
      columns: 2,
      size: 's',
      odd: true,
      labels: 'icons',
      short: false,
    });
    // 120: halves of 52 hold them short
    expect(readoutsRow(ruler, 120, ROOM)).toEqual({
      columns: 2,
      size: 'xs',
      odd: true,
      labels: 'icons',
      short: true,
    });
    // nothing holds even a line of its own: one a line, as short as it can be written
    expect(readoutsRow(ruler, 40, ROOM)).toEqual({
      columns: 1,
      size: 'xs',
      odd: false,
      labels: 'icons',
      short: true,
    });
  });

  it('decides the labels and the figures each on their own line: words that hold stay over a figure that shrank', () => {
    const short = ROOM.map((stat, index) => ({ ...stat, label: ['Temp', 'Vocht', 'Aan'][index]! }));
    expect(readoutsRow(ruler, 180, short)).toEqual({ ...whole, size: 'xs', short: true });
  });

  it('writes the labels one way where asked: words wrap before they give way, icons and none never do', () => {
    // 260: the words do not hold their thirds and must stay — two and one
    expect(readoutsRow(ruler, 260, ROOM, { labels: 'words' })).toEqual({
      columns: 2,
      size: 's',
      odd: true,
      labels: 'words',
      short: false,
    });
    expect(readoutsRow(ruler, 320, ROOM, { labels: 'icons' })).toEqual({
      ...whole,
      labels: 'icons',
    });
    expect(readoutsRow(ruler, 180, ROOM, { labels: 'none' })).toEqual({
      ...whole,
      labels: 'none',
      size: 'xs',
      short: true,
    });
  });

  it('wrapped, lays the row out as every other card’s: the words stay, the columns give way, no unit is shortened', () => {
    const wider = SESSION.map((stat) =>
      stat.label === 'Seit' ? { ...stat, value: '2 h 10' } : stat,
    );
    for (const [width, items] of [
      [320, SESSION],
      [284, SESSION],
      [150, SESSION],
      [320, wider],
      [260, ROOM],
      [180, ROOM],
      [120, ROOM],
    ] as const)
      expect(readoutsRow(ruler, width, items, { wrap: true }), `${width}`).toEqual({
        ...statsRow(ruler, width, items),
        labels: 'words',
        short: false,
      });
    // with icons, by the figures alone: 150 holds two halves of 67 and no third of 39
    expect(readoutsRow(ruler, 150, ROOM, { wrap: true, labels: 'icons' })).toEqual({
      columns: 2,
      size: 's',
      odd: true,
      labels: 'icons',
      short: false,
    });
  });
});
