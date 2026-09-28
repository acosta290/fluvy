// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { derivePalette, seedOf } from '@fluvy/tokens/runtime';
import { accentCss, accentHex, AccentSheet } from '../look/accent.js';

const linen = derivePalette(seedOf('linen'));

describe('a card’s colour on its palette', () => {
  it('resolves a name, a hex or a triplet on the palette it wears, and nothing for the accent itself', () => {
    expect(accentHex('linen', 'light', 'teal')).toBe(linen.light.state['presence-home'].ink);
    expect(accentHex('linen', 'dark', 'teal')).toBe(linen.dark.state['presence-home'].ink);
    expect(accentHex('linen', 'light', '#ABC')).toBe('#aabbcc');
    expect(accentHex('linen', 'light', [255, 0, 0])).toBe('#ff0000');
    for (const none of [undefined, null, '', 'primary', 'accent', 'nope'])
      expect(accentHex('linen', 'light', none)).toBeUndefined();
    // a key that is not one of ours (no look on the page) derives on the default palette
    expect(accentHex('', 'light', 'teal')).toBe(accentHex('linen', 'light', 'teal'));
    expect(accentHex('custom:soft:warm:#716345::', 'light', '#00b894')).toBe('#00b894');
  });

  it('writes the accent’s family and nothing else, the same twice', () => {
    const css = accentCss('linen', 'light', '#0000ff');
    expect(css).toContain('--fluvy-accent:#');
    expect(css).toContain('--fluvy-graph-12:#');
    expect(css).toContain('--fluvy-state-light-active-fill:#');
    expect(css).not.toContain('--fluvy-card:');
    expect(css).not.toContain('--fluvy-state-climate-heat');
    expect(accentCss('linen', 'light', '#0000ff')).toBe(css);
    expect(accentCss('linen', 'dark', '#0000ff')).not.toBe(css);
    expect(accentCss('volt', 'light', '#0000ff')).not.toBe(css);
  });

  it('is a sheet the card adopts: its own colour on its children, each item’s on its data-accent', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const accents = new AccentSheet();
    accents.adopt(root);
    accents.adopt(root);
    expect(root.adoptedStyleSheets).toHaveLength(1);
    const sheet = root.adoptedStyleSheets[0]!;
    expect(accents.wears('linen', 'light')).toBe(true);
    expect(accents.wears('linen', 'light')).toBe(false);
    accents.host('teal');
    accents.begin();
    expect(accents.item('#ff0000')).toBe('#ff0000');
    expect(accents.item('nope')).toBeUndefined();
    accents.commit();
    const rules = [...sheet.cssRules].map((rule) => rule.cssText);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatch(/^:host > \* \{/);
    expect(rules[1]).toMatch(/^\[data-accent="#ff0000"\] \{/);
    // nothing changed: nothing written again; the mode changes: derived again
    accents.commit();
    expect(sheet.cssRules).toHaveLength(2);
    expect(accents.wears('linen', 'dark')).toBe(true);
    accents.host('teal');
    accents.begin();
    accents.commit();
    expect(sheet.cssRules).toHaveLength(1);
    expect(sheet.cssRules[0]!.cssText).not.toBe(rules[0]);
    // no colour of its own: an empty sheet
    accents.host(undefined);
    accents.commit();
    expect(sheet.cssRules).toHaveLength(0);
  });
});
