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

  it('lets the badge go before a single segment of the sub does', () => {
    // 300 − 56 − 56 leaves 188: "Peak price · 0.42 €/kWh" (184) fits beside it; at 280 (168) the badge goes, the sub stays whole
    const peak = { width: 280, title: 'Energy flow', sub: 'Peak price · 0.42 €/kWh', badge };
    expect(fitter().fit({ ...peak, width: 300 }).badge).not.toBe(nothing);
    const fitted = fitter().fit(peak);
    expect(fitted.badge).toBe(nothing);
    expect(fitted.sub).toBe('Peak price · 0.42 €/kWh');
  });

  it('lets the icon go last, and the sub takes the room back', () => {
    // 132 − 56 leaves 76 for an 88 px title: the circle goes; 132 then holds title and sub in full
    const fitted = fitter().fit({ width: 132, title: 'Energy flow', sub: 'Live · 5 s ago', badge });
    expect(fitted.icon).toBe(false);
    expect(fitted.badge).toBe(nothing);
    expect(fitted.sub).toBe('Live · 5 s ago');
  });

  it('lets the icon go for a sub whose first segment the column cannot hold beside it', () => {
    // 158 − 56 leaves 102: "Where" (40) fits, "Desde medianoche" (128) does not; 158 holds it
    const fitted = fitter().fit({ width: 158, title: 'Where', sub: 'Desde medianoche · 17,7 kWh' });
    expect(fitted.icon).toBe(false);
    expect(fitted.sub).toBe('Desde medianoche');
  });
});

describe('a badge that is the card’s alert (badgeFirst)', () => {
  it('keeps the badge while the sub’s trailing segments give way', () => {
    // 220 − 56 (icon) − 36 (the badge "On" and its gap) leaves 128: "6 sensors · 3 rooms" (152) loses its rooms
    const sub = '6 sensors · 3 rooms';
    const plain = fitter().fit({ width: 220, title: 'Doors', sub, badge });
    expect(plain.badge).toBe(nothing);
    const first = fitter().fit({ width: 220, title: 'Doors', sub, badge, badgeFirst: true });
    expect(first.badge).not.toBe(nothing);
    expect(first.sub).toBe('6 sensors');
  });

  it('lets the badge go only where the sub’s first segment would not hold beside it', () => {
    const fitted = fitter().fit({
      width: 180,
      title: 'Doors',
      sub: 'Eighteen sensors · 3 rooms',
      badge,
      badgeFirst: true,
    });
    expect(fitted.badge).toBe(nothing);
    expect(fitted.sub).toBe('Eighteen sensors');
  });
});

describe('a list’s circles (rowsKeepIcon) by what ends each row', () => {
  it('counts a chevron’s 44 or a switch’s 56, not an empty value', () => {
    // 200 − 56 − 12 − 44 leaves 88 for "Front door" (80): kept; a switch's 56 leaves 76: given
    expect(fitter().rowsKeepIcon(200, [{ title: 'Front door', value: '', end: 44 }])).toBe(true);
    expect(fitter().rowsKeepIcon(200, [{ title: 'Front door', value: '', end: 56 }])).toBe(false);
    // no end and no value: only the circle and the gap (the old reading of a chevron row)
    expect(fitter().rowsKeepIcon(160, [{ title: 'Front door', value: '' }])).toBe(true);
  });

  it('gives every circle with the one row that needs it', () => {
    const rows = [
      { title: 'Gate', value: 'Locked' },
      { title: 'Living room motion', value: 'Not detected' },
    ];
    expect(fitter().rowsKeepIcon(250, rows)).toBe(false);
    expect(fitter().rowsKeepIcon(360, rows)).toBe(true);
  });

  it('measures a row’s room without its circle once given', () => {
    expect(fitter().rowRoom(200, '', { icon: false, end: 44 })).toBe(200 - 12 - 44);
    expect(fitter().rowRoom(200, 'Open', { end: 0 })).toBe(200 - 56 - 12);
  });
});
