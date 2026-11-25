// @vitest-environment happy-dom
import { html, render } from 'lit';
import { describe, expect, it } from 'vitest';

import { acrossFit, acrossRow, endsHold, levelReadout, saidWidth } from './across.js';
import type { TextRuler } from './fit.js';

/**
 * A ruler that says every character is 8 px wide in a label, 12 in a figure at m and 10 at s, 7 in a ruler's word,
 * and a unit 4 px from its figure.
 */
const ruler = {
  width: (...[cls, text, , unit = '']: [string, string, string?, string?]) => {
    const letter = cls.includes('--m') ? 12 : cls.includes('--s') ? 10 : cls === 'fv-axis' ? 7 : 8;
    return text.length * letter + (unit ? 4 + unit.length * 8 : 0);
  },
} as unknown as TextRuler;

const HUNDRED = [{ value: '100', unit: '%' }];

describe('a level across: the row’s fit', () => {
  it('gives the readout a column as wide as its label or its widest figure, on the 4 grid, the ruler the rest 24 from it', () => {
    // "Position" is 64, "100 %" at m 48: the label's 64, then 24, then the ruler
    expect(acrossFit(ruler, 320, 'Position', HUNDRED)).toEqual({
      column: 64,
      gap: 24,
      length: 232,
    });
    // a figure wider than the label decides: "−10.5 °C" at m is 60 + 4 + 16
    expect(acrossFit(ruler, 320, 'Low', [{ value: '−10.5', unit: '°C' }])).toEqual({
      column: 80,
      gap: 24,
      length: 216,
    });
    // the widest of every figure it can say, a word for off among them
    expect(acrossFit(ruler, 320, 'Speed', [...HUNDRED, { value: 'Switched off' }])?.column).toBe(
      144,
    );
  });

  it('closes the 24 to 16 where the ruler would go under 128, then stands the readout over it', () => {
    expect(acrossFit(ruler, 216, 'Position', HUNDRED)).toEqual({
      column: 64,
      gap: 24,
      length: 128,
    });
    expect(acrossFit(ruler, 208, 'Position', HUNDRED)).toEqual({
      column: 64,
      gap: 16,
      length: 128,
    });
    expect(acrossFit(ruler, 207, 'Position', HUNDRED)).toBeNull();
  });

  it('keeps room for the word after the figure, which gives way before the row stacks', () => {
    // "down" after "100 %": 48 + 8 + 32, on the grid 88
    expect(saidWidth(ruler, 'down')).toBe(40);
    expect(saidWidth(ruler, '')).toBe(0);
    expect(acrossFit(ruler, 320, 'Position', HUNDRED, 'down')).toEqual({
      column: 88,
      gap: 24,
      length: 208,
    });
    // too narrow for the word beside a 128 ruler: the column is the label's again
    expect(acrossFit(ruler, 216, 'Position', HUNDRED, 'down')).toEqual({
      column: 64,
      gap: 24,
      length: 128,
    });
  });

  it('holds two words at a ruler’s ends where they stand 8 apart', () => {
    // "Closed" 42 and "Open" 28
    expect(endsHold(ruler, 78, 'Closed', 'Open')).toBe(true);
    expect(endsHold(ruler, 77, 'Closed', 'Open')).toBe(false);
  });
});

describe('a level across: the readout and the row', () => {
  const drawn = (template: unknown): HTMLElement => {
    const host = document.createElement('div');
    render(template, host);
    return host;
  };
  const level = {
    label: 'Position',
    glyph: 'updown',
    value: '35',
    unit: '%',
    said: 'down',
    figures: HUNDRED,
  };
  const parts = (host: HTMLElement): (string | undefined)[] =>
    [...host.querySelectorAll('.fv-readout__value > span')].map((part) => part.textContent?.trim());

  it('says its figure at m with its word after it where the column holds both', () => {
    const host = drawn(levelReadout(ruler, 88, level));
    expect(host.querySelector('.fv-readout')?.classList.contains('fv-readout--m')).toBe(true);
    expect(host.querySelector('.fv-readout__label')?.textContent).toBe('Position');
    expect(parts(host)).toEqual(['35', '%', 'down']);
  });

  it('drops the word first, then a size, and draws its label as a glyph where its words do not hold', () => {
    expect(parts(drawn(levelReadout(ruler, 64, level)))).toEqual(['35', '%']);
    const narrow = drawn(levelReadout(ruler, 44, level));
    expect(narrow.querySelector('.fv-readout')?.classList.contains('fv-readout--s')).toBe(true);
    const label = narrow.querySelector('.fv-readout__label--icon');
    expect(label?.querySelector('svg')).not.toBeNull();
    expect(label?.querySelector('.fv-sr')?.textContent).toBe('Position');
  });

  it('says a word or a dash with no unit and no word after it', () => {
    expect(
      parts(drawn(levelReadout(ruler, 88, { ...level, value: '—', unit: '', said: '' }))),
    ).toEqual(['—']);
  });

  it('lays the readout beside the ruler in its column, or over it, the ends’ words over the ruler', () => {
    const readout = levelReadout(ruler, 64, level);
    const control = html`<fluvy-ruler></fluvy-ruler>`;
    const ends = [
      [0, 'Closed'],
      [1, 'Open'],
    ] as const;
    const beside = drawn(acrossRow({ column: 64, gap: 24, length: 232 }, readout, ends, control));
    const row = beside.querySelector<HTMLElement>('.cv-across')!;
    expect([row.className.trim(), row.style.getPropertyValue('--cv-column')]).toEqual([
      'cv-across',
      '64px',
    ]);
    expect(row.querySelector('.fv-readout + .cv-across__ruler > .fv-ruler-labels')).not.toBeNull();
    expect(
      [...row.querySelectorAll('.fv-ruler-labels span')].map((word) => word.textContent),
    ).toEqual(['Closed', 'Open']);
    expect(row.querySelector('.cv-across__ruler > .fv-ruler-labels + fluvy-ruler')).not.toBeNull();
    // 16 from the ruler where 24 leaves it short
    expect(
      drawn(acrossRow({ column: 64, gap: 16, length: 128 }, readout, ends, control))
        .querySelector('.cv-across')
        ?.classList.contains('cv-across--close'),
    ).toBe(true);
    // no fit: the readout over the ruler, no column said
    const over = drawn(acrossRow(null, readout, ends, control)).querySelector<HTMLElement>(
      '.cv-across',
    )!;
    expect(over.classList.contains('cv-across--stacked')).toBe(true);
    expect(over.style.getPropertyValue('--cv-column')).toBe('');
  });
});
