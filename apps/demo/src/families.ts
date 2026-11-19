import type { GlyphName } from '@fluvy/ui';
import type { StringKey } from './strings.js';

/** The playground's sheets grouped by what they show: the demo's showcase, one entry each in its menu. */
export interface Family {
  readonly key: string;
  readonly label: StringKey;
  /** The glyph beside its entry. */
  readonly glyph: GlyphName;
  readonly sheets: readonly string[];
}

export const FAMILIES: readonly Family[] = [
  {
    key: 'home',
    label: 'family.home',
    glyph: 'home',
    sheets: ['home', 'home-extras', 'ambient', 'rooms'],
  },
  {
    key: 'devices',
    label: 'family.devices',
    glyph: 'devices',
    sheets: [
      'devices-motion',
      'vacuum',
      'devices-security',
      'cameras',
      'printer',
      'appliances',
      'slider',
      'slider-card',
      'lights',
    ],
  },
  { key: 'climate', label: 'family.climate', glyph: 'thermo', sheets: ['climate', 'schedule'] },
  { key: 'vehicles', label: 'family.vehicles', glyph: 'car', sheets: ['vehicle'] },
  {
    key: 'energy',
    label: 'family.energy',
    glyph: 'bolt',
    sheets: [
      'period',
      'usage',
      'flow',
      'energy',
      'balance',
      'storage',
      'meters',
      'sankey',
      'solar',
      'arrays',
      'history-bars',
    ],
  },
  {
    key: 'charts',
    label: 'family.charts',
    glyph: 'chart',
    sheets: ['chart-styles', 'animated', 'chart'],
  },
  { key: 'media', label: 'family.media', glyph: 'speaker', sheets: ['media', 'remote'] },
  { key: 'time', label: 'family.time', glyph: 'clock', sheets: ['clocks', 'calendar'] },
  {
    key: 'helpers',
    label: 'family.helpers',
    glyph: 'sliders',
    sheets: [
      'inputs',
      'lists',
      'items',
      'template',
      'automations',
      'alerts',
      'web',
      'expander',
      'swipe',
    ],
  },
];

/** The sheets a name stands for: a family's, or the one sheet of that name. */
export const sheetsOf = (name: string): readonly string[] =>
  FAMILIES.find((family) => family.key === name)?.sheets ?? [name];

/** The family a name belongs to (its own, or the one holding that sheet). */
export const familyOf = (name: string): Family | undefined =>
  FAMILIES.find((family) => family.key === name || family.sheets.includes(name));

/** The cards as the README groups them: a group of the menu each, its cards by their short names, in its order. */
export interface CardGroup {
  readonly key: string;
  readonly label: StringKey;
  readonly glyph: GlyphName;
  readonly cards: readonly string[];
}

export const CARD_GROUPS: readonly CardGroup[] = [
  {
    key: 'control',
    label: 'group.control',
    glyph: 'sliders',
    cards: [
      'tile',
      'tiles',
      'template',
      'light',
      'lights',
      'slider',
      'thermostat',
      'schedule',
      'cover',
      'fan',
      'vacuum',
      'media',
      'now-playing',
      'remote',
      'printer',
      'vehicle',
      'entities',
      'rounds',
      'thermostats',
    ],
  },
  {
    key: 'energy',
    label: 'group.energy',
    glyph: 'bolt',
    cards: [
      'energy-period',
      'energy-usage',
      'energy',
      'energy-flow',
      'energy-balance',
      'grid',
      'batteries',
      'ev-charger',
      'energy-sankey',
      'energy-score',
      'energy-devices',
      'meters',
      'production',
      'stat-tiles',
      'distribution',
    ],
  },
  {
    key: 'security',
    label: 'group.security',
    glyph: 'shield',
    cards: ['lock', 'alarm', 'camera', 'cameras', 'openings', 'sensor', 'humidity', 'bars'],
  },
  {
    key: 'charts',
    label: 'group.charts',
    glyph: 'chart',
    cards: ['chart', 'gauge', 'history-bars'],
  },
  {
    key: 'home',
    label: 'group.home',
    glyph: 'clock',
    cards: [
      'hello',
      'weather',
      'compass',
      'people',
      'map',
      'room',
      'heading',
      'chips',
      'scene',
      'scenes',
      'actions',
      'clock',
      'calendar',
      'readouts',
      'helpers',
      'updates',
      'timer',
      'todo',
      'automations',
      'items',
      'web',
      'expander',
      'swipe',
    ],
  },
  {
    key: 'appliances',
    label: 'group.appliances',
    glyph: 'devices',
    cards: ['appliance', 'appliances', 'alerts'],
  },
];

/** The group a card is listed in. */
export const groupOf = (short: string): CardGroup | undefined =>
  CARD_GROUPS.find((group) => group.cards.includes(short));
