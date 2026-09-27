import { describe, expect, it } from 'vitest';
import {
  HOUSE_DEFAULTS,
  parseHouse,
  parsePalette,
  parsePersonal,
  PERSONAL_DEFAULTS,
  resolveSettings,
  SettingsStore,
  pageScope,
  wearsLook,
  type SettingsHass,
} from '../settings/index.js';

describe('parsing stored settings', () => {
  it('falls back to the defaults for anything missing, broken or unknown', () => {
    expect(parseHouse(undefined)).toEqual(HOUSE_DEFAULTS);
    expect(parseHouse('nonsense')).toEqual(HOUSE_DEFAULTS);
    expect(
      parseHouse({
        palette: 'tartan',
        shape: 'blob',
        scope: 'moon',
        dashboards: 'x',
        frame: 1,
        icons: 'yes',
        activity: 'no',
      }),
    ).toEqual(HOUSE_DEFAULTS);
    expect(parsePersonal({ language: 'fr', motion: 'fast', haptics: 'yes' })).toEqual(
      PERSONAL_DEFAULTS,
    );
  });

  it('keeps what is well formed', () => {
    expect(
      parseHouse({
        palette: 'volt',
        shape: 'round',
        pills: 'crisp',
        scope: 'everywhere',
        dashboards: ['fluvy-home', 3],
        frame: false,
        icons: false,
        activity: false,
        history: false,
        extra: true,
      }),
    ).toEqual({
      version: 1,
      palette: 'volt',
      shape: 'round',
      pills: 'crisp',
      scope: 'everywhere',
      dashboards: ['fluvy-home'],
      frame: false,
      icons: false,
      activity: false,
      history: false,
    });
  });

  it('accepts a custom palette only whole, and drops what its character does not use', () => {
    expect(
      parsePalette({ character: 'vivid', base: 'cool', accent: '#FF4A1A', fill: 'solid' }),
    ).toEqual({
      character: 'vivid',
      base: 'cool',
      accent: '#ff4a1a',
      fill: 'solid',
    });
    expect(
      parsePalette({
        character: 'soft',
        base: 'warm',
        accent: '#123456',
        fill: 'solid',
        highlight: '#e2ff3d',
      }),
    ).toEqual({ character: 'soft', base: 'warm', accent: '#123456' });
    expect(parsePalette({ character: 'vivid', base: 'cool', accent: 'red' })).toBeUndefined();
    expect(parsePalette({ character: 'loud', base: 'cool', accent: '#ff0000' })).toBeUndefined();
  });
});

describe('resolving the two layers', () => {
  it("takes the house's look unless the person chose their own, as a whole", () => {
    const house = parseHouse({
      palette: 'volt',
      shape: 'round',
      pills: 'soft',
      scope: 'everywhere',
    });
    expect(resolveSettings(house, PERSONAL_DEFAULTS).look).toEqual({
      palette: 'volt',
      shape: 'round',
      pills: 'soft',
    });
    const own = resolveSettings(house, parsePersonal({ palette: 'blaze' }));
    expect(own.look).toEqual({ palette: 'blaze', shape: 'round', pills: 'soft' });
    expect(
      resolveSettings(house, parsePersonal({ palette: 'blaze', pills: 'crisp' })).look.pills,
    ).toBe('crisp');
    expect(own.personalLook).toBe(true);
    expect(
      resolveSettings(house, parsePersonal({ palette: 'blaze', shape: 'crisp' })).look.shape,
    ).toBe('crisp');
  });

  it('keeps everywhere only while Home Assistant wears the Fluvy theme', () => {
    expect(pageScope('everywhere', 'Fluvy')).toBe('everywhere');
    // another theme in the profile (Home Assistant's own, or any other): its pages are its, Fluvy's dashboards stay
    expect(pageScope('everywhere', 'default')).toBe('dashboards');
    expect(pageScope('everywhere', 'Minimalist')).toBe('dashboards');
    // before Home Assistant says (the first paint) the setting holds
    expect(pageScope('everywhere', undefined)).toBe('everywhere');
    expect(pageScope('dashboards', 'Fluvy')).toBe('dashboards');
  });

  it('puts the look on the chosen dashboards, or every fluvy one when none is chosen', () => {
    expect(wearsLook({ dashboards: [] }, 'fluvy-home')).toBe(true);
    expect(wearsLook({ dashboards: [] }, 'dashboard-garden')).toBe(false);
    expect(wearsLook({ dashboards: ['dashboard-garden'] }, 'dashboard-garden')).toBe(true);
    expect(wearsLook({ dashboards: ['dashboard-garden'] }, 'fluvy-home')).toBe(false);
    expect(wearsLook({ dashboards: [] }, undefined)).toBe(false);
  });
});

describe('the settings store', () => {
  function fakeHass() {
    const listeners = new Map<string, (message: { value: unknown }) => void>();
    const sent: { type: string; key?: unknown; value?: unknown }[] = [];
    const hass = {
      connection: {
        subscribeMessage: <T>(callback: (message: T) => void, message: { type: string }) => {
          listeners.set(message.type, callback as (message: { value: unknown }) => void);
          return Promise.resolve(() => listeners.delete(message.type));
        },
      },
      callWS: <T>(message: { type: string; key?: unknown; value?: unknown }) => {
        sent.push(message);
        return Promise.resolve(undefined as T);
      },
    } as unknown as SettingsHass;
    return { hass, listeners, sent };
  }

  it('hands over the resolved settings on each answer and change, and caches them', () => {
    const { hass, listeners } = fakeHass();
    const stored = new Map<string, string>();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    } as Storage;
    const store = new SettingsStore(() => hass, storage);
    const seen: string[] = [];
    store.start((settings) => seen.push(`${String(settings.look.palette)}/${settings.scope}`));
    listeners.get('frontend/subscribe_system_data')?.({
      value: { palette: 'volt', scope: 'everywhere' },
    });
    listeners.get('frontend/subscribe_user_data')?.({ value: null });
    listeners.get('frontend/subscribe_user_data')?.({ value: { palette: 'noir' } });
    expect(seen).toEqual(['volt/everywhere', 'volt/everywhere', 'noir/everywhere']);
    expect(JSON.parse(stored.get('fluvy:settings') ?? '{}').house.palette).toBe('volt');
  });

  it("writes the house's settings whole and parsed, and a person's without the fields they cleared", async () => {
    const { hass, listeners, sent } = fakeHass();
    const store = new SettingsStore(() => hass, undefined);
    store.start(() => undefined);
    await store.saveHouse({ palette: 'blaze', shape: 'round' });
    expect(sent[0]).toEqual({
      type: 'frontend/set_system_data',
      key: 'fluvy',
      value: { ...HOUSE_DEFAULTS, palette: 'blaze', shape: 'round' },
    });
    listeners.get('frontend/subscribe_user_data')?.({ value: { palette: 'volt', language: 'es' } });
    await store.savePersonal({ palette: undefined });
    expect(sent[1]).toEqual({
      type: 'frontend/set_user_data',
      key: 'fluvy',
      value: { ...PERSONAL_DEFAULTS, language: 'es' },
    });
  });
});
