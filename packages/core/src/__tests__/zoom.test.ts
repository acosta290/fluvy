// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyZoom, startZoom, ZOOM_VAR } from '../look/zoom.js';
import { DEVICE_KEY, DEVICE_ZOOMS, readDevice, writeDevice } from '../settings/device.js';

const factor = (): string => document.documentElement.style.getPropertyValue(ZOOM_VAR);
/** The page at an address (happy-dom's own way to move the window without a navigation). */
const visit = (url: string): void =>
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);

describe('the size this device reads at', () => {
  let stop: (() => void) | undefined;
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    stop?.();
    stop = undefined;
    applyZoom(100);
  });

  it('is a factor on <html>, taken off at 100 %', () => {
    applyZoom(125);
    expect(factor()).toBe('1.25');
    applyZoom(90);
    expect(factor()).toBe('0.9');
    applyZoom(100);
    expect(factor()).toBe('');
    writeDevice({ zoom: 150 });
    applyZoom(); // the device's own, by default
    expect(factor()).toBe('1.5');
  });

  it('remembers ?zoom= and drops it from the address, keeping the rest and the hash', () => {
    visit('http://home.local/fluvy-home?edit=1&zoom=125&tabs=pills#rooms');
    stop = startZoom();
    expect(readDevice().zoom).toBe(125);
    expect(factor()).toBe('1.25');
    expect(location.href).toBe('http://home.local/fluvy-home?edit=1&tabs=pills#rooms');
  });

  it('drops a size it does not know too, and leaves the remembered one', () => {
    writeDevice({ zoom: 110 });
    visit('http://home.local/fluvy-home?zoom=120');
    stop = startZoom();
    expect(readDevice().zoom).toBe(110);
    expect(factor()).toBe('1.1');
    expect(location.href).toBe('http://home.local/fluvy-home');
  });

  it('applies what the device remembers when the address says nothing, and follows another tab', () => {
    writeDevice({ zoom: 150 });
    visit('http://home.local/fluvy-home');
    stop = startZoom();
    expect(factor()).toBe('1.5');
    // another tab of this browser changed the device: the storage event brings the size here
    writeDevice({ zoom: 100 });
    window.dispatchEvent(new StorageEvent('storage', { key: DEVICE_KEY }));
    expect(factor()).toBe('');
    writeDevice({ zoom: 125 });
    window.dispatchEvent(new StorageEvent('storage', { key: 'fluvy:look' }));
    expect(factor()).toBe(''); // another key: nothing to do
    window.dispatchEvent(new StorageEvent('storage', { key: null })); // the storage was cleared, or all of it changed
    expect(factor()).toBe('1.25');
    stop();
    stop = undefined;
    writeDevice({ zoom: 90 });
    window.dispatchEvent(new StorageEvent('storage', { key: DEVICE_KEY }));
    expect(factor()).toBe('1.25'); // stopped: no longer following
  });

  it('agrees with the loader, which sets the size before Home Assistant paints', () => {
    const loader = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../bundle/src/loader.js'),
      'utf8',
    );
    expect(loader).toContain(`localStorage.getItem('${DEVICE_KEY}')`);
    expect(loader).toContain(`setProperty('${ZOOM_VAR}'`);
    const zooms = /const ZOOMS = \[([^\]]+)\]/.exec(loader)?.[1];
    expect(zooms?.split(',').map((n) => Number(n.trim()))).toEqual([...DEVICE_ZOOMS]);
    // the same arithmetic: the factor is the percent over 100, and 100 writes nothing
    expect(loader).toContain('device.zoom !== 100');
    expect(loader).toContain('String(device.zoom / 100)');
  });
});
