import { readStored, writeStored } from '../storage.js';

/*
 * What this browser is: a wall panel, or not. The house says how its walls behave (`HouseSettings.wall`); the
 * device says it is one, in its own storage, so a person's phone never becomes a wall because the house has some.
 */

export const DEVICE_KEY = 'fluvy:device';
export const DEVICE_VERSION = 1;

export interface DeviceSettings {
  readonly version: typeof DEVICE_VERSION;
  /** This browser is a wall panel. */
  readonly wall: boolean;
}

export const DEVICE_DEFAULTS: DeviceSettings = { version: DEVICE_VERSION, wall: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What this browser remembers of itself; anything missing or broken is the default. */
export function parseDevice(raw: unknown): DeviceSettings {
  const value = isRecord(raw) ? raw : {};
  return {
    version: DEVICE_VERSION,
    wall: typeof value['wall'] === 'boolean' ? value['wall'] : DEVICE_DEFAULTS.wall,
  };
}

export const readDevice = (): DeviceSettings => parseDevice(readStored<unknown>(DEVICE_KEY));

export function writeDevice(patch: Partial<Omit<DeviceSettings, 'version'>>): DeviceSettings {
  const next = parseDevice({ ...readDevice(), ...patch });
  writeStored(DEVICE_KEY, next);
  return next;
}

/**
 * `?kiosk` on a dashboard's address says what this device is: `?kiosk`, `?kiosk=1` and `?kiosk=on` make it a wall,
 * `?kiosk=0` and `?kiosk=off` a device again; anything else leaves it as it is (undefined). The answer is remembered.
 */
export function latchFromUrl(search: string): boolean | undefined {
  const params = new URLSearchParams(search);
  if (!params.has('kiosk')) return undefined;
  const value = params.get('kiosk')?.toLowerCase() ?? '';
  const wall =
    value === '' || value === '1' || value === 'on'
      ? true
      : value === '0' || value === 'off'
        ? false
        : undefined;
  if (wall !== undefined) writeDevice({ wall });
  return wall;
}
