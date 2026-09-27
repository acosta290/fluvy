import { describe, expect, it } from 'vitest';
import { AT, columns, deviceFor, frameWidth, parseState, serialize } from './state.js';

const parse = (query: string) => parseState(new URLSearchParams(query));

describe('the demo state', () => {
  it('starts on the home family, a phone, English, the light mode and Blaze', () => {
    expect(parse('')).toEqual({
      view: { kind: 'sheet', name: 'home' },
      mode: 'light',
      device: 'phone',
      language: 'en',
      look: { palette: 'blaze', shape: 'soft', pills: 'round' },
      at: AT,
    });
    expect(parse('mode=dark').mode).toBe('dark');
    // the link pins the mode and the device: a shared link opens as it was seen
    expect(serialize(parse('')).toString()).toBe('mode=light&device=phone');
    expect(serialize(parse('palette=linen')).toString()).toBe(
      'mode=light&device=phone&palette=linen',
    );
  });

  it('shows the device the visitor is on, until the link says', () => {
    expect(deviceFor(1440)).toBe('desktop');
    expect(deviceFor(1024)).toBe('tablet');
    expect(deviceFor(412)).toBe('phone-l');
    expect(deviceFor(360)).toBe('phone');
    expect(parseState(new URLSearchParams(''), 1440).device).toBe('desktop');
    expect(parseState(new URLSearchParams('device=phone'), 1440).device).toBe('phone');
  });

  it('round-trips every choice through the playground’s parameters', () => {
    for (const query of [
      'panel=scope&mode=dark&device=tablet&lang=es&palette=volt&shape=round&pills=soft',
      'sheet=energy&mode=light&device=desktop',
      'history=1&moment=week&mode=light&device=phone',
      'activity=1&mode=dark&device=phone&at=2026-01-01T08%3A00%3A00',
      'mode=light&device=phone&accent=%23ff4a1a&character=vivid&base=cool&fill=solid&highlight=%23e2ff3d',
    ])
      expect(serialize(parse(query)).toString()).toBe(query);
  });

  it('keeps the playground’s width as one column at that width', () => {
    const state = parse('width=392&device=desktop');
    expect(frameWidth(state)).toBe(392);
    expect(columns(state)).toBe(1);
    expect(frameWidth(parse('device=tablet'))).toBe(472);
    expect(columns(parse('device=tablet'))).toBe(2);
  });

  it('falls back to the defaults on nonsense', () => {
    const state = parse(
      'panel=nope&device=watch&width=9000&palette=neon&shape=hex&lang=xx&at=never',
    );
    expect(state.view).toEqual({ kind: 'panel', tab: 'appearance' });
    expect(state.device).toBe('phone');
    expect(state.frameWidth).toBeUndefined();
    expect(state.look).toEqual({ palette: 'blaze', shape: 'soft', pills: 'round' });
    expect(state.language).toBe('en');
    expect(state.at).toBe(AT);
    expect(parse('accent=notacolour').look.palette).toBe('blaze');
  });

  it('carries a Home Assistant path from Pages’ fallback', () => {
    expect(parse('path=%2Flogbook').path).toBe('/logbook');
    expect(serialize(parse('path=%2Flogbook')).has('path')).toBe(false);
  });
});
