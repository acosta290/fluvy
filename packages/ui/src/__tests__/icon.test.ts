// @vitest-environment happy-dom
import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import { LEVEL_GLYPHS } from '../glyph-sets/levels.js';
import { addGlyphs } from '../glyphs.js';
import { CARD_ICONS, icon } from '../parts.js';

/** An icon reference drawn into a box of its own. */
function drawn(ref: string): HTMLElement {
  const host = document.createElement('div');
  render(icon(ref), host);
  return host;
}

describe('a fluvy: icon on a card (1.23, #226)', () => {
  it('draws a glyph of the set as its strokes', () => {
    const svg = drawn('fluvy:cloud-sun').querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(drawn('fluvy:cloud-sun').querySelector('ha-icon')).toBeNull();
  });

  it('draws one no chunk has added through the set on the glyph’s own ink, and its strokes once one has', () => {
    const outline = drawn('fluvy:battery-low').querySelector<HTMLElement & { icon?: string }>(
      'ha-icon',
    );
    expect(outline?.icon).toBe(`${CARD_ICONS}:battery-low`);
    expect(outline?.classList.contains('fv-haicon--fluvy')).toBe(true);
    addGlyphs(LEVEL_GLYPHS);
    expect(drawn('fluvy:battery-low').querySelector('ha-icon')).toBeNull();
    expect(drawn('fluvy:battery-low').querySelector('svg')?.innerHTML).toContain('width="3"');
  });

  it('leaves any other set’s icon to Home Assistant as it names it', () => {
    const material = drawn('mdi:sofa').querySelector<HTMLElement & { icon?: string }>('ha-icon');
    expect(material?.icon).toBe('mdi:sofa');
    expect(material?.classList.contains('fv-haicon--fluvy')).toBe(false);
  });
});
