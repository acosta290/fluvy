// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOUSE_DEFAULTS, PERSONAL_DEFAULTS, resolveSettings } from '../settings/schema.js';
import { DEVICE_KEY } from '../settings/device.js';
import { WALL_ATTRIBUTE, WALL_BACKGROUND_VAR } from '../look/attributes.js';
import {
  createWall,
  PAUSED_KEY,
  type WallPhase,
  type WallState,
  type WallUi,
} from '../wall/controller.js';

const panels = {
  lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
  'fluvy-wall': { component_name: 'lovelace', url_path: 'fluvy-wall', title: null, icon: null },
  fluvy: { component_name: 'custom', url_path: 'fluvy', title: 'Fluvy', icon: null },
};

function setup(wallPatch: Partial<ReturnType<typeof resolveSettings>['wall']> = {}, dark = false) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify({ version: 1, wall: true }));
  sessionStorage.removeItem(PAUSED_KEY);
  history.replaceState(null, '', '/fluvy-wall/wall');
  let settings = resolveSettings(
    { ...HOUSE_DEFAULTS, wall: { ...HOUSE_DEFAULTS.wall, ...wallPatch } },
    PERSONAL_DEFAULTS,
  );
  const states: WallState[] = [];
  const phases: WallPhase[] = [];
  const shown = { sleep: 0, closed: 0, corner: 0, toast: 0 };
  let wakeUp: (() => void) | undefined;
  const ui: WallUi = {
    sleep: (options) => {
      shown.sleep++;
      wakeUp = options.onWake;
      return () => shown.closed++;
    },
    corner: () => {
      shown.corner++;
      return () => shown.corner--;
    },
    paused: () => {
      shown.toast++;
      return () => shown.toast--;
    },
  };
  const listeners = new Set<() => void>();
  const hass = {
    panels,
    states: { 'sun.sun': { state: 'above_horizon', attributes: {} } },
    themes: { darkMode: dark },
  } as never;
  const wall = createWall({
    doc: document,
    win: window,
    hass: () => hass,
    settings: () => settings,
    onSettings: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setWall: (state) => states.push(state),
    ui: () => Promise.resolve(ui),
    onPhase: (phase) => phases.push(phase),
  });
  const change = (patch: Partial<typeof settings.wall>): void => {
    settings = { ...settings, wall: { ...settings.wall, ...patch } };
    for (const listener of listeners) listener();
  };
  return { wall, states, phases, shown, change, wake: () => wakeUp?.() };
}

describe('the wall controller', () => {
  beforeEach(() =>
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    }),
  );
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute(WALL_ATTRIBUTE);
    document.documentElement.style.removeProperty(WALL_BACKGROUND_VAR);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('is on for a wall dashboard: the attribute, the look told, the corner; off on Fluvy’s own panel', async () => {
    const { wall, states, shown, phases } = setup({ background: 'wall' });
    expect(wall.phase()).toBe('awake');
    expect(document.documentElement.hasAttribute(WALL_ATTRIBUTE)).toBe(true);
    expect(document.documentElement.style.getPropertyValue(WALL_BACKGROUND_VAR)).toContain(
      'mesh-wall',
    );
    expect(states.at(-1)).toEqual({ on: true, dark: undefined });
    await vi.advanceTimersByTimeAsync(1);
    expect(shown.corner).toBe(1);
    history.replaceState(null, '', '/fluvy/wall');
    window.dispatchEvent(new Event('location-changed'));
    expect(wall.phase()).toBe('off');
    expect(document.documentElement.hasAttribute(WALL_ATTRIBUTE)).toBe(false);
    expect(states.at(-1)).toEqual({ on: false, dark: undefined });
    expect(shown.corner).toBe(0);
    expect(phases).toEqual(['awake', 'off']);
    wall.stop();
  });

  it('sleeps after the minutes, wakes on the screensaver’s touch, and forces the night’s mode', async () => {
    const { wall, states, shown, wake } = setup({ after: 2, theme: 'dark' });
    expect(states.at(-1)).toEqual({ on: true, dark: true });
    await vi.advanceTimersByTimeAsync(2 * 60_000 + 1);
    expect(wall.phase()).toBe('asleep');
    expect(shown.sleep).toBe(1);
    wake();
    expect(wall.phase()).toBe('awake');
    expect(shown.closed).toBe(1);
    wall.stop();
  });

  it('pauses on the corner’s hold (the chrome back, the toast), resumes by hand or when the screensaver would come', async () => {
    const { wall, shown } = setup({ after: 5 });
    wall.pause();
    await vi.advanceTimersByTimeAsync(1);
    expect(wall.phase()).toBe('paused');
    expect(sessionStorage.getItem(PAUSED_KEY)).toBe('1');
    expect(document.documentElement.hasAttribute(WALL_ATTRIBUTE)).toBe(false);
    expect(shown.toast).toBe(1);
    wall.resume();
    await vi.advanceTimersByTimeAsync(1);
    expect(wall.phase()).toBe('awake');
    expect(shown.toast).toBe(0);
    wall.pause();
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1);
    expect(wall.phase()).toBe('awake');
    wall.stop();
  });

  it('follows a change of the house’s wall settings', async () => {
    const { wall, change, states } = setup({ dashboards: ['fluvy-wall'] });
    expect(wall.on()).toBe(true);
    change({ dashboards: ['lovelace'] });
    expect(wall.on()).toBe(false);
    change({ dashboards: [], theme: 'dark' });
    expect(wall.on()).toBe(true);
    expect(states.at(-1)).toEqual({ on: true, dark: true });
    wall.stop();
  });
});
