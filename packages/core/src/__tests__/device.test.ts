// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEVICE_KEY,
  DEVICE_PERFORMANCES,
  DEVICE_ZOOMS,
  isLite,
  latchFromUrl,
  latchZoomFromUrl,
  parseDevice,
  readDevice,
  wornLite,
  writeDevice,
} from '../settings/device.js';
import { HOUSE_DEFAULTS, PERSONAL_DEFAULTS, resolveSettings } from '../settings/schema.js';

/** A device as it is from the factory: no wall, at 100 %, Auto, Home Assistant's own sidebar. */
const FACTORY = { version: 1, wall: false, zoom: 100, performance: 'auto', dock: false } as const;

describe('what this device is', () => {
  beforeEach(() => localStorage.clear());

  it('is not a wall until it says so, and remembers it', () => {
    expect(readDevice()).toEqual(FACTORY);
    expect(writeDevice({ wall: true })).toEqual({ ...FACTORY, wall: true });
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toEqual({
      ...FACTORY,
      wall: true,
    });
    expect(readDevice().wall).toBe(true);
  });

  it('reads a broken value as the default', () => {
    localStorage.setItem(DEVICE_KEY, '{"wall":"yes","performance":"turbo","dock":"yes"}');
    expect(readDevice()).toEqual(FACTORY);
    localStorage.setItem(DEVICE_KEY, 'nonsense');
    expect(readDevice()).toEqual(FACTORY);
  });

  it.each([
    ['?kiosk', true],
    ['?kiosk=1', true],
    ['?kiosk=on', true],
    ['?kiosk=ON', true],
    ['?kiosk=0', false],
    ['?kiosk=off', false],
    ['?kiosk=maybe', undefined],
    ['?edit=1', undefined],
    ['', undefined],
  ])('latches %s as %s', (search, wall) => {
    writeDevice({ wall: false });
    expect(latchFromUrl(search)).toBe(wall);
    expect(readDevice().wall).toBe(wall ?? false);
  });

  it('reads its size only from the listed ones, and keeps it beside the wall', () => {
    expect(DEVICE_ZOOMS).toEqual([90, 100, 110, 125, 150]);
    for (const zoom of DEVICE_ZOOMS) expect(parseDevice({ zoom }).zoom).toBe(zoom);
    expect(parseDevice({ zoom: 120 }).zoom).toBe(100);
    expect(parseDevice({ zoom: '125' }).zoom).toBe(100);
    expect(parseDevice({ zoom: 1.25 }).zoom).toBe(100);
    expect(writeDevice({ zoom: 125 })).toEqual({ ...FACTORY, zoom: 125 });
    expect(writeDevice({ wall: true })).toEqual({ ...FACTORY, wall: true, zoom: 125 });
  });

  it.each([
    ['?zoom=125', 125, 125],
    ['?zoom=90', 90, 90],
    ['?zoom=100', 100, 100],
    ['?zoom=off', 100, 100],
    ['?zoom=OFF', 100, 100],
    ['?kiosk&zoom=150', 150, 150],
    ['?zoom=120', undefined, 110],
    ['?zoom=1.25', undefined, 110],
    ['?zoom', undefined, 110],
    ['?zoom=', undefined, 110],
    ['?edit=1', undefined, 110],
    ['', undefined, 110],
  ])('latches the size of %s as %s', (search, latched, remembered) => {
    writeDevice({ zoom: 110 });
    expect(latchZoomFromUrl(search)).toBe(latched);
    expect(readDevice().zoom).toBe(remembered);
  });
});

describe('how hard this device works (Lite, #165)', () => {
  /** A system that does or does not ask for less motion, and a browser that says (or not) how much memory it has. */
  function system(reduced: boolean, memory?: number): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduced && query.includes('reduce'),
    }));
    vi.stubGlobal('navigator', { ...navigator, deviceMemory: memory });
  }
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('is Auto from the factory, and keeps a choice of the three beside the size and the wall', () => {
    expect(DEVICE_PERFORMANCES).toEqual(['auto', 'full', 'lite']);
    for (const performance of DEVICE_PERFORMANCES)
      expect(parseDevice({ performance }).performance).toBe(performance);
    expect(writeDevice({ performance: 'lite' })).toEqual({ ...FACTORY, performance: 'lite' });
    expect(writeDevice({ zoom: 125 })).toEqual({ ...FACTORY, zoom: 125, performance: 'lite' });
  });

  it('keeps the sidebar beside the page as its own choice (#173), off where a 1.19 device stored none', () => {
    localStorage.setItem(DEVICE_KEY, '{"version":1,"wall":true,"zoom":125,"performance":"lite"}');
    expect(readDevice()).toEqual({ ...FACTORY, wall: true, zoom: 125, performance: 'lite' });
    expect(writeDevice({ dock: true })).toEqual({
      ...FACTORY,
      wall: true,
      zoom: 125,
      performance: 'lite',
      dock: true,
    });
    expect(readDevice().dock).toBe(true);
    expect(writeDevice({ wall: false }).dock).toBe(true);
    expect(writeDevice({ dock: false }).dock).toBe(false);
  });

  it('draws Lite where the device chose it, never where it chose Full, and for Auto where the system asks for less motion or memory is short', () => {
    system(false, 8);
    expect(isLite('auto')).toBe(false);
    expect(isLite('lite')).toBe(true);
    system(true, 8);
    expect(isLite('auto')).toBe(true);
    expect(isLite('full')).toBe(false);
    system(false, 2);
    expect(isLite('auto')).toBe(true);
    system(false, 4);
    expect(isLite('auto')).toBe(false);
    // a browser that does not say counts by the motion alone
    system(false, undefined);
    expect(isLite('auto')).toBe(false);
    // what the device remembers, read by default
    writeDevice({ performance: 'lite' });
    expect(isLite()).toBe(true);
  });

  it('turns down what exists and nothing more: motion, the blur behind a see-through card, the charts’ motion', () => {
    const own = resolveSettings(
      {
        ...HOUSE_DEFAULTS,
        cards: { opacity: 70, blur: true, unavailable: 'quiet', border: false },
      },
      { ...PERSONAL_DEFAULTS, haptics: false, holdToSlide: true },
    );
    const lite = wornLite(own);
    expect(lite).toEqual({
      ...own,
      motion: 'reduced',
      // the border is the house's still: Lite turns down what costs a frame, not what a card looks like
      cards: { opacity: 70, blur: false, unavailable: 'quiet', border: false },
      charts: { ...own.charts, animate: false },
    });
    // what the person and the house chose is untouched: Full wears it again
    expect(own.motion).toBe('system');
    expect(own.cards.blur).toBe(true);
    expect(own.charts.animate).toBe(true);
  });
});
