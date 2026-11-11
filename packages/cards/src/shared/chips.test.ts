// @vitest-environment happy-dom
import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import { chipRow, fittedColumns } from './chips.js';
import type { TextRuler } from './fit.js';

/** A stand-in for the card's ruler: a chip's label at 7 a letter (its pill adds 16 each side's 8). */
const ruler = { width: (_cls: string, text: string) => text.length * 7 } as unknown as TextRuler;

/** A thermostat's three modes in German: "Automatisch" is the widest chip, 77 + 16. */
const MODES = [
  { key: 'off', label: 'Aus' },
  { key: 'heat', label: 'Heizen' },
  { key: 'auto', label: 'Automatisch' },
];

describe('a row of three chips', () => {
  it('stands in one line while the widest holds a third of it', () => {
    // 3 × 93 and two 8 gaps: 295
    expect(fittedColumns(MODES, { ruler, width: 295 })).toBe(3);
  });

  it('goes two and one before a label is cut, the last chip taking the whole line', () => {
    expect(fittedColumns(MODES, { ruler, width: 294 })).toBe(2);
    expect(fittedColumns(MODES, { ruler, width: 194 })).toBe(2);
    const host = document.createElement('div');
    render(
      chipRow(MODES, () => undefined, 'full', { ruler, width: 200 }),
      host,
    );
    const chips = [...host.querySelectorAll<HTMLElement>('.fv-chip')];
    expect(host.querySelector<HTMLElement>('.fv-chips')?.style.gridTemplateColumns).toBe(
      'repeat(2, minmax(0, 1fr))',
    );
    expect(chips.map((chip) => chip.style.gridColumn)).toEqual(['', '', 'span 2']);
  });

  it('stands one a line only where not even two hold', () => {
    expect(fittedColumns(MODES, { ruler, width: 193 })).toBe(1);
  });

  it('gives its glyphs up where not even a chip of its own line holds the widest word beside one, never a word', () => {
    // a dehumidifier's mode in Portuguese, half a section: 91 + 16 holds 112, not beside its glyph's 24
    const modes = [
      { key: 'cool', label: 'Resfriar', glyph: 'snow' },
      { key: 'dry', label: 'Desumidificar', glyph: 'humid' },
    ];
    const glyphs = (width: number): number => {
      const host = document.createElement('div');
      render(
        chipRow(modes, () => undefined, 'full', { ruler, width }),
        host,
      );
      return host.querySelectorAll('.fv-chip svg').length;
    };
    expect(glyphs(131)).toBe(2);
    expect(glyphs(112)).toBe(0);
  });
});

describe('a word of Home Assistant’s no chip of a whole row holds', () => {
  /** A fan's speeds in Home Assistant's Russian, with Fluvy's own word for the two it names. */
  const speeds = [
    { key: 'auto', label: 'Автоматический', own: 'Авто' },
    { key: 'low', label: 'Низкий', own: 'Низкая' },
    { key: 'natural', label: 'Естественный ветер' },
  ];
  const said = (style: 'full' | 'chips', width: number): string[] => {
    const host = document.createElement('div');
    render(
      chipRow(speeds, () => undefined, style, { ruler, width }),
      host,
    );
    return [...host.querySelectorAll('.fv-chip')].map((chip) => chip.textContent?.trim() ?? '');
  };

  it('says Fluvy’s own where it has one, filled or content-sized, and Home Assistant’s wherever it holds', () => {
    // "Автоматический" is 98 + 16 filled, 98 + 28 content-sized; "Естественный ветер" has no word of Fluvy's
    expect(said('full', 113)).toEqual(['Авто', 'Низкий', 'Естественный ветер']);
    expect(said('chips', 125)).toEqual(['Авто', 'Низкий', 'Естественный ветер']);
    expect(said('full', 126)).toEqual(['Автоматический', 'Низкий', 'Естественный ветер']);
    expect(said('chips', 126)).toEqual(['Автоматический', 'Низкий', 'Естественный ветер']);
  });
});
