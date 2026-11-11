// @vitest-environment happy-dom
import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { readout, type ReadoutOptions } from '../parts.js';

/** A readout drawn into the document. */
function drawn(options: Partial<ReadoutOptions> = {}): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  render(readout({ label: 'Temperature', value: '21.4', unit: '°C', size: 's', ...options }), host);
  return host.querySelector<HTMLElement>('.fv-readout')!;
}

afterEach(() => document.body.replaceChildren());

describe('a readout’s label', () => {
  it('is its words over its figure, the unit 4 after it', () => {
    const el = drawn();
    expect(el.className).toBe('fv-readout fv-readout--s');
    expect(el.querySelector('.fv-readout__label')?.textContent).toBe('Temperature');
    expect(el.querySelector('.fv-readout__label svg')).toBeNull();
    expect(el.querySelector('.fv-sr')).toBeNull();
    expect(el.querySelector('.fv-unit')?.className).toBe('fv-unit');
  });

  it('is an icon in the label’s line where its words gave way, the words still read out', () => {
    const label = drawn({ glyph: 'thermo' }).querySelector('.fv-readout__label')!;
    expect(label.classList.contains('fv-readout__label--icon')).toBe(true);
    expect(label.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    const said = label.querySelector('.fv-sr')!;
    expect(said.textContent).toBe('Temperature');
    // the measurer holds no hidden word to its column
    expect(said.getAttribute('data-measure')).toBe('skip');
  });

  it('is not drawn where none was asked for: the figure alone, the words read out before it', () => {
    const el = drawn({ glyph: null });
    expect(el.querySelector('.fv-readout__label')).toBeNull();
    const [said, value] = [...el.children];
    expect(said?.className).toBe('fv-sr');
    expect(said?.textContent).toBe('Temperature');
    expect(value?.className).toBe('fv-readout__value');
  });
});

describe('a readout’s unit', () => {
  it('attaches to its figure where asked (a degree alone), as a kana or kanji word does by itself', () => {
    expect(drawn({ unit: '°', tight: true }).querySelector('.fv-unit')?.className).toBe(
      'fv-unit fv-unit--tight',
    );
    expect(drawn({ unit: '時間' }).querySelector('.fv-unit')?.className).toBe(
      'fv-unit fv-unit--tight',
    );
    expect(drawn({ unit: '°' }).querySelector('.fv-unit')?.className).toBe('fv-unit');
  });
});
