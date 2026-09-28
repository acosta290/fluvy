// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEVICE_KEY, latchFromUrl, readDevice, writeDevice } from '../settings/device.js';

describe('what this device is', () => {
  beforeEach(() => localStorage.clear());

  it('is not a wall until it says so, and remembers it', () => {
    expect(readDevice()).toEqual({ version: 1, wall: false });
    expect(writeDevice({ wall: true })).toEqual({ version: 1, wall: true });
    expect(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}')).toEqual({
      version: 1,
      wall: true,
    });
    expect(readDevice().wall).toBe(true);
  });

  it('reads a broken value as the default', () => {
    localStorage.setItem(DEVICE_KEY, '{"wall":"yes"}');
    expect(readDevice()).toEqual({ version: 1, wall: false });
    localStorage.setItem(DEVICE_KEY, 'nonsense');
    expect(readDevice()).toEqual({ version: 1, wall: false });
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
});
