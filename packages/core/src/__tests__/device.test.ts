// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEVICE_KEY,
  DEVICE_ZOOMS,
  latchFromUrl,
  latchZoomFromUrl,
  parseDevice,
  readDevice,
  writeDevice,
} from '../settings/device.js';

describe('what this device is', () => {
  beforeEach(() => localStorage.clear());

  it('is not a wall until it says so, and remembers it', () => {
    expect(readDevice()).toEqual({ version: 1, wall: false, zoom: 100 });
    expect(writeDevice({ wall: true })).toEqual({ version: 1, wall: true, zoom: 100 });
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toEqual({
      version: 1,
      wall: true,
      zoom: 100,
    });
    expect(readDevice().wall).toBe(true);
  });

  it('reads a broken value as the default', () => {
    localStorage.setItem(DEVICE_KEY, '{"wall":"yes"}');
    expect(readDevice()).toEqual({ version: 1, wall: false, zoom: 100 });
    localStorage.setItem(DEVICE_KEY, 'nonsense');
    expect(readDevice()).toEqual({ version: 1, wall: false, zoom: 100 });
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
    expect(writeDevice({ zoom: 125 })).toEqual({ version: 1, wall: false, zoom: 125 });
    expect(writeDevice({ wall: true })).toEqual({ version: 1, wall: true, zoom: 125 });
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
