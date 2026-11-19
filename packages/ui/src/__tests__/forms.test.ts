// @vitest-environment happy-dom
import { html, render, type TemplateResult } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { options, stepper, type OptionItem } from '../parts.js';

/** A template drawn into the document. */
function drawn(template: TemplateResult): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  render(template, host);
  return host;
}

afterEach(() => document.body.replaceChildren());

describe('a stepper', () => {
  it('is its two halves alone, as it always was, where it is told no value', () => {
    const pill = drawn(stepper(() => undefined)).querySelector('.fv-stepper')!;
    expect(pill.classList.contains('fv-stepper--value')).toBe(false);
    expect([...pill.children].map((child) => child.className)).toEqual([
      'fv-stepper__half',
      'fv-stepper__half',
    ]);
  });

  it('says the value it sets between its halves, on the room it was given (#215)', () => {
    const pill = drawn(
      stepper(() => undefined, { value: html`21.5°`, width: 56, disabled: true }),
    ).querySelector('.fv-stepper')!;
    expect(pill.classList.contains('fv-stepper--value')).toBe(true);
    const [minus, value, plus] = [...pill.children] as HTMLElement[];
    expect([minus?.className, plus?.className]).toEqual(['fv-stepper__half', 'fv-stepper__half']);
    expect(value?.className).toBe('fv-stepper__value');
    expect(value?.textContent).toBe('21.5°');
    expect(value?.style.width).toBe('56px');
    // a reader hears the value it moves to
    expect(value?.getAttribute('aria-live')).toBe('polite');
    expect((minus as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('option tiles in their icon form (#215)', () => {
  const MODES: readonly OptionItem[] = [
    { key: 'off', label: 'Off', glyph: 'power', tone: 'neutral' },
    { key: 'heat', label: 'Heat', glyph: 'flame', tone: 'heat', active: true },
  ];

  it('are each its glyph over its word, no value, chosen in its own tone', () => {
    const tiles = [
      ...drawn(options(MODES, () => undefined, 4, 44, 2, 'icon')).querySelectorAll('button'),
    ];
    expect(tiles.map((tile) => tile.className.trim())).toEqual([
      'fv-option fv-option--icon',
      'fv-option fv-option--icon is-active fv-option--heat',
    ]);
    expect(tiles.map((tile) => tile.querySelector('.fv-option__label')?.textContent)).toEqual([
      'Off',
      'Heat',
    ]);
    expect(tiles[0]?.querySelector('.fv-option__value')).toBeNull();
    expect(tiles[0]?.style.minHeight).toBe('44px');
  });

  it('are their glyphs alone where a row cannot hold its words, each word read out and its title', () => {
    const short = MODES.map((mode) => ({ ...mode, short: true }));
    const tile = drawn(options(short, () => undefined, 4, 44, 2, 'icon')).querySelector('button')!;
    expect(tile.querySelector('.fv-option__label')).toBeNull();
    expect(tile.querySelector('.fv-sr')?.textContent).toBe('Off');
    expect(tile.getAttribute('title')).toBe('Off');
    expect(tile.querySelector('.fv-option__glyph svg')).not.toBeNull();
  });
});
