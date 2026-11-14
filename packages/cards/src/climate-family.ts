import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { chipBlock, chipRows, optionBlock, optionRows } from './shared/heights.js';
import { pretty } from './shared/mode-words.js';

/**
 * The Thermostat card, announced at start and defined when its chunk lands (`climate-cards.ts`), as the Vacuum card
 * is: what the card picker lists and how tall the card is at a 360 column, without the card itself; and the way to
 * what says what a thermostat is doing, for the cards every page carries. Every page carries this file: it stays
 * tiny.
 */

/**
 * What says what a thermostat is doing (`thermostat/doing.ts`, 1.21, #185), once it has landed: it travels with the
 * card's chunk, fetched as the bundle starts; `null` where it cannot be fetched.
 */
type Reading = typeof import('./thermostat/doing.js');
let reading: Reading | null | undefined;
let fetching: Promise<unknown> | undefined;

/** Fetches the reading, once: with the families, so a tile asked to say it does from its first render. */
export const loadDoing = (): Promise<unknown> =>
  (fetching ??= import('./thermostat/doing.js').then(
    (module) => (reading = module),
    () => (reading = null),
  ));

/**
 * The reading for a card every page carries that is asked to say what a thermostat is doing (a climate's tile, a
 * room's climate row): none until it has landed — the card says the state, as before, and draws again as it lands.
 */
export function doingReading(host: { requestUpdate(): void }): Reading | undefined {
  if (reading === undefined) void loadDoing().then(() => host.requestUpdate());
  return reading ?? undefined;
}

/** Unless the config lists its own, a water heater shows its first six operations, a humidifier Off and five modes. */
export const SHOWN = 6;
/** The modes a thermostat is counted with where the house is not there to say (a missing one draws these). */
export const DEFAULT_MODES: readonly string[] = ['off', 'heat', 'cool'];

/** What a thermostat offers as the house describes it: its modes, presets and fan speeds, a range (a low, a high). */
export interface ThermostatOffers {
  readonly modes: readonly string[];
  readonly presets: readonly string[];
  readonly fans: readonly string[];
  readonly range: boolean;
}
/** Where the house is not there to say, or has not described the entity: Off · Heat · Cool, nothing more. */
const UNDESCRIBED: ThermostatOffers = { modes: DEFAULT_MODES, presets: [], fans: [], range: false };

/**
 * The card's height at a 360 column, for the automatic dashboard's columns: the head and the dial (a dial without
 * its stepper is 56 shorter), the readout and its ruler (two rulers for a range), then the modes under their label —
 * tiles in rows of 84 (three a row, two where a word is long: `optionRows`), chips in rows of 44 — and the presets and
 * the fan speeds as rows of chips, each under its label. The modes are the config's, else what the entity offers as
 * the house describes it (`house-heights.ts`); the presets and the fan speeds are the entity's. A card that keeps to
 * the essentials while off is reserved its height when on.
 */
export function thermostatHeight(
  config: LovelaceCardConfig,
  offers: ThermostatOffers = UNDESCRIBED,
): number {
  const id = config['entity'];
  const domain = typeof id === 'string' ? id.slice(0, id.indexOf('.')) : 'climate';
  const variant = config['variant'];
  // a range (its low and its high) draws the ruler twice: 96 more (the bubble row goes, each ruler keeps its label)
  const height =
    variant === 'compact'
      ? 164
      : variant === 'ruler'
        ? 268 + (offers.range ? 96 : 0)
        : config['show_stepper'] === false
          ? 300
          : 356;
  const asked = config['modes'];
  const shown =
    Array.isArray(asked) && asked.length
      ? (asked as readonly string[]).filter((m) => offers.modes.includes(m === '__off' ? 'off' : m))
      : domain === 'climate'
        ? offers.modes
        : offers.modes.slice(0, SHOWN);
  const words = shown.map((m) => pretty(m.replace('_', '/')));
  const chips = (items: readonly string[], asked: unknown): number => {
    const style = asked === 'chips' ? 'chips' : 'full';
    return chipBlock(chipRows(items, style), style);
  };
  const modes =
    config['show_modes'] === false || !shown.length
      ? 0
      : (config['modes_style'] ?? 'tiles') === 'tiles'
        ? optionBlock(optionRows(words))
        : chips(words, config['modes_style']);
  const presets =
    config['show_presets'] === false
      ? 0
      : chips(offers.presets.map(pretty), config['preset_style']);
  const fans =
    config['show_fan'] === false ? 0 : chips(offers.fans.map(pretty), config['fan_style']);
  return height + modes + presets + fans;
}

export const CLIMATE_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-thermostat-card',
    'Fluvy · Thermostat',
    'Climate, water heater or humidifier on a dial, with modes, presets and fan speeds.',
    thermostatHeight,
  ],
];
