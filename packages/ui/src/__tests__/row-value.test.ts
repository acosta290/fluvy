// @vitest-environment happy-dom
import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { listRow, wordsClass, type ListRowOptions } from '../parts.js';

/** A row's value, drawn into the document. */
function value(options: Partial<ListRowOptions>): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  render(listRow({ title: 'Hall motion', trailing: 'value', ...options }), host);
  return host.querySelector<HTMLElement>('.fv-row__value')!;
}

afterEach(() => document.body.replaceChildren());

describe('a row’s value in words', () => {
  it('is a state of several words in any script, which a card may wrap between them', () => {
    for (const state of ['Not detected', 'Niet thuis', 'Не обнаружено', 'Δεν εντοπίστηκε'])
      expect(wordsClass(state), state).toBe('fv-row__value--words');
    // one word has no second line to take; a figure and its unit read as no words unless the unit is one
    for (const state of ['Open', 'Открыто', '21.6 °C', '45 %', '—', ''])
      expect(wordsClass(state), state).toBe('');
    expect(wordsClass(undefined)).toBe('');
  });

  it('is prose where it is long and in Latin words: the smaller two-line style', () => {
    expect(wordsClass('Grid-Connected, normally')).toBe('fv-row__value--text');
    expect(wordsClass('Niet gedetecteerd')).toBe('fv-row__value--text');
    // a long state in another script keeps the value's size, and wraps between its words
    expect(wordsClass('Не обнаружено движение')).toBe('fv-row__value--words');
  });
});

describe('a row’s value as its card fitted it', () => {
  it('wraps to the width its card measured, and takes the smaller sizes where asked', () => {
    const plain = value({ value: 'Open' });
    expect(plain.className.split(/\s+/).filter(Boolean)).toEqual(['fv-row__value']);
    expect(plain.getAttribute('style')).toBeNull();
    const wrapped = value({ value: 'Не обнаружено', valueWidth: 100 });
    expect(wrapped.classList.contains('fv-row__value--wrap')).toBe(true);
    expect(wrapped.style.width).toBe('100px');
    expect(value({ value: 'Воспроизведение', valueSize: 's' }).classList).toContain(
      'fv-row__value--s',
    );
    expect(value({ value: 'Воспроизведение', valueSize: 'xs' }).classList).toContain(
      'fv-row__value--xs',
    );
  });
});
