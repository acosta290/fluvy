// @vitest-environment happy-dom
import { nothing } from 'lit';
import { describe, expect, it } from 'vitest';
import { HeadFit } from './head.js';

/** A fitter on a host that only registers controllers; its ruler is a stub — 8 px a glyph, a pill adds its sides. */
function fitter(): HeadFit {
  const host = {
    addController() {},
    removeController() {},
    requestUpdate() {},
    renderRoot: undefined,
  } as unknown as ConstructorParameters<typeof HeadFit>[0];
  const fit = new HeadFit(host);
  Object.assign(fit as unknown as { ruler: unknown }, {
    ruler: {
      width: (_class: string, text: string) => text.length * 8,
      pill: (_class: string, text: string, sides: number) => text.length * 8 + sides,
      clear() {},
    },
  });
  return fit;
}

const badge = { text: 'On', tone: 'solar' as const };

describe('a fitted head', () => {
  it('keeps everything when the column holds it', () => {
    const fitted = fitter().fit({
      width: 300,
      title: 'Energy',
      sub: 'South roof · 5.4 kWp',
      badge,
    });
    expect(fitted.sub).toBe('South roof · 5.4 kWp');
    expect(fitted.badge).not.toBe(nothing);
    expect(fitted.icon).toBe(true);
  });

  it('lets the badge go first, then the sub’s trailing segments, and keeps the icon', () => {
    // 160 − 56 (icon) − 56 (badge + gap) leaves 48: "Energy flow" (88) sends the badge aside; 104 holds it
    const fitted = fitter().fit({ width: 160, title: 'Energy flow', sub: 'Live · 5 s ago', badge });
    expect(fitted.badge).toBe(nothing);
    expect(fitted.sub).toBe('Live');
    expect(fitted.icon).toBe(true);
  });

  it('lets the icon go last, and the sub takes the room back', () => {
    // 132 − 56 leaves 76 for an 88 px title: the circle goes; 132 then holds title and sub in full
    const fitted = fitter().fit({ width: 132, title: 'Energy flow', sub: 'Live · 5 s ago', badge });
    expect(fitted.icon).toBe(false);
    expect(fitted.badge).toBe(nothing);
    expect(fitted.sub).toBe('Live · 5 s ago');
  });
});
