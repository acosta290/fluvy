import { isLanguageCode, parsePalette, type LanguageCode, type Look } from '@fluvy/core';
import { isPaletteName, isPillName, isShapeName, type PaletteMode } from '@fluvy/tokens/runtime';

/**
 * What the demo shows, and the URL that says it. The parameters are the playground's (`sheet`, `mode`, `width`,
 * `lang`, `palette`, `shape`, `pills`, `accent` with `character`, `base`, `fill`, `highlight`, `panel`, `history`,
 * `activity`, `moment`, `at`), so every playground link opens here as it does there; `device` is the demo's own.
 */

export type DeviceName = 'phone' | 'phone-l' | 'tablet' | 'desktop';

export interface Device {
  /** A dashboard column's width on that device (a section's, the design's 360 on a phone). */
  readonly frame: number;
  /** How many columns stand side by side. */
  readonly columns: number;
}

export const DEVICES: Readonly<Record<DeviceName, Device>> = {
  phone: { frame: 360, columns: 1 },
  'phone-l': { frame: 412, columns: 1 },
  tablet: { frame: 472, columns: 2 },
  desktop: { frame: 448, columns: 3 },
};
export const DEVICE_NAMES = Object.keys(DEVICES) as readonly DeviceName[];

export const PANEL_TABS = ['appearance', 'scope', 'dashboard', 'preferences', 'about'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

export type DemoLanguage = LanguageCode;

export type DemoView =
  | { readonly kind: 'sheet'; readonly name: string }
  | { readonly kind: 'panel'; readonly tab: PanelTab }
  | { readonly kind: 'history'; readonly moment?: string }
  | { readonly kind: 'activity'; readonly moment?: string };

export interface DemoState {
  readonly view: DemoView;
  readonly mode: PaletteMode;
  readonly device: DeviceName;
  /** `width=`: one column at that width, whatever the device (the playground's links); undefined: the device's. */
  readonly frameWidth?: number | undefined;
  readonly language: DemoLanguage;
  readonly look: Look;
  /** The moment the page's clock starts at. */
  readonly at: string;
  /** A Home Assistant path the page was opened on (Pages' 404 hands it over): said once, as a notice. */
  readonly path?: string;
}

/** The evening every sheet shows: Thursday 17 September 2026, 21:47. */
export const AT = '2026-09-17T21:47:12';
/** What the demo opens on: the light mode and Blaze, the electric line's warm palette. */
export const DEFAULT_LOOK: Look = { palette: 'blaze', shape: 'soft', pills: 'round' };
export const DEFAULT_SHEET = 'home';
export const DEFAULT_VIEW: DemoView = { kind: 'sheet', name: DEFAULT_SHEET };

const isDevice = (value: unknown): value is DeviceName =>
  typeof value === 'string' && Object.hasOwn(DEVICES, value);
const isTab = (value: unknown): value is PanelTab =>
  typeof value === 'string' && (PANEL_TABS as readonly string[]).includes(value);

function lookOf(params: URLSearchParams): Look {
  const accent = params.get('accent');
  const highlight = params.get('highlight');
  const custom = accent
    ? parsePalette({
        character: params.get('character') ?? 'vivid',
        base: params.get('base') ?? 'neutral',
        accent,
        fill: params.get('fill') ?? 'tint',
        ...(highlight ? { highlight } : {}),
      })
    : undefined;
  const palette = params.get('palette');
  const shape = params.get('shape');
  const pills = params.get('pills');
  return {
    palette: custom ?? (isPaletteName(palette) ? palette : DEFAULT_LOOK.palette),
    shape: isShapeName(shape) ? shape : DEFAULT_LOOK.shape,
    pills: isPillName(pills) ? pills : DEFAULT_LOOK.pills,
  };
}

function viewOf(params: URLSearchParams): DemoView {
  const panel = params.get('panel');
  if (panel !== null) return { kind: 'panel', tab: isTab(panel) ? panel : 'appearance' };
  const moment = params.get('moment');
  if (params.get('history') === '1') return { kind: 'history', ...(moment ? { moment } : {}) };
  if (params.get('activity') === '1') return { kind: 'activity', ...(moment ? { moment } : {}) };
  return { kind: 'sheet', name: params.get('sheet') || DEFAULT_SHEET };
}

/** The device a screen of `viewportWidth` is: what the demo shows first, until the link or a chip says otherwise. */
export function deviceFor(viewportWidth: number): DeviceName {
  if (viewportWidth >= 1280) return 'desktop';
  if (viewportWidth >= 900) return 'tablet';
  return viewportWidth >= 400 ? 'phone-l' : 'phone';
}

/** The state a URL asks for; what it leaves unsaid is the default (the light mode) or the visitor's screen. */
export function parseState(params: URLSearchParams, viewportWidth = 0): DemoState {
  const mode = params.get('mode');
  const width = Number(params.get('width'));
  const device = params.get('device');
  const at = params.get('at');
  const path = params.get('path');
  return {
    view: viewOf(params),
    mode: mode === 'dark' ? 'dark' : 'light',
    device: isDevice(device) ? device : deviceFor(viewportWidth),
    ...(Number.isInteger(width) && width >= 280 && width <= 1200 ? { frameWidth: width } : {}),
    language: isLanguageCode(params.get('lang')) ? (params.get('lang') as LanguageCode) : 'en',
    look: lookOf(params),
    at: at && Number.isFinite(Date.parse(at)) ? at : AT,
    ...(path ? { path } : {}),
  };
}

/** The URL of a state: the playground's names, only what differs from the defaults (the mode and the device always: a link pins what was seen). */
export function serialize(state: DemoState): URLSearchParams {
  const params = new URLSearchParams();
  const { view } = state;
  if (view.kind === 'sheet') {
    if (view.name !== DEFAULT_SHEET) params.set('sheet', view.name);
  } else if (view.kind === 'panel') params.set('panel', view.tab);
  else {
    params.set(view.kind, '1');
    if (view.moment) params.set('moment', view.moment);
  }
  params.set('mode', state.mode);
  params.set('device', state.device);
  if (state.frameWidth) params.set('width', String(state.frameWidth));
  if (state.language !== 'en') params.set('lang', state.language);
  const { palette, shape, pills } = state.look;
  if (typeof palette === 'string') {
    if (palette !== DEFAULT_LOOK.palette) params.set('palette', palette);
  } else {
    params.set('accent', palette.accent);
    params.set('character', palette.character);
    params.set('base', palette.base);
    if (palette.fill) params.set('fill', palette.fill);
    if (palette.highlight) params.set('highlight', palette.highlight);
  }
  if (shape !== DEFAULT_LOOK.shape) params.set('shape', shape);
  if (pills !== DEFAULT_LOOK.pills) params.set('pills', pills);
  if (state.at !== AT) params.set('at', state.at);
  return params;
}

/** A frame's width: the link's, else the device's column. */
export const frameWidth = (state: DemoState): number =>
  state.frameWidth ?? DEVICES[state.device].frame;

/** How many frames stand side by side: one at a link's width, else the device's columns. */
export const columns = (state: DemoState): number =>
  state.frameWidth ? 1 : DEVICES[state.device].columns;

/** Two views are the same thing on screen. */
export const sameView = (a: DemoView, b: DemoView): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
