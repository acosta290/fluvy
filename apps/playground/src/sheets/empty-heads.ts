import type { LovelaceCardConfig } from '@fluvy/core';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import { sheet as appliances } from './appliances.js';
import { sheet as gallery } from './gallery.js';

/*
 * A head with nothing in it (#259): a card whose config asks its circle away (`show_icon: never`), hides its name
 * (`name_lines: 0`) and turns off its line, its badge and whatever trails its head draws no head at all; its first part
 * sits at the card's 20 all round, its article says its title, and what it declares drops the head and the gap under
 * it. The reporter's Appliances card first, in its layouts and with nothing to list, each beside its headed twin in
 * half a section (a phone's two cards, 172) and in half a wider one (266); then every card whose head its config can
 * empty, the documentation's example beside it with its head emptied.
 *   ?sheet=empty-heads&at=2026-09-17T19:50:00Z
 */

/** What empties a head: no circle, no name. Each card adds its own: its line, its badge, what trails it. */
const EMPTY = { show_icon: 'never', name_lines: '0' } as const;

/** A frame of the gallery's, by its title (`gallery/<card>`, `<card> · <layout>`). */
const example = (title: string): FrameSpec => {
  const frame = gallery.frames.find((f) => f.title === title);
  if (!frame) throw new Error(`empty-heads: no gallery frame "${title}"`);
  return frame;
};

/** A card beside its twin whose head is left with nothing in it. */
const pair = (
  title: string,
  card: LovelaceCardConfig,
  quiet: Record<string, unknown>,
  more: Partial<FrameSpec> = {},
): FrameSpec => ({
  title,
  cards: [card, { ...card, ...quiet, ...EMPTY }],
  ...more,
});

/** The same, each half a section, drawn again at 172 and 266 (`heights.mjs`). */
const half = (
  title: string,
  card: LovelaceCardConfig,
  quiet: Record<string, unknown>,
  more: Partial<FrameSpec> = {},
): FrameSpec => pair(title, { ...card, cols: 6 }, quiet, { heights: [172, 266], ...more });

/** The house's appliances, in English, as the gallery names them. */
const list = (more: Record<string, unknown> = {}): LovelaceCardConfig => ({
  ...(example('appliances').cards[0] as LovelaceCardConfig),
  ...more,
});
const house = { hass: example('appliances').hass! };

/** The reporter's card (#259): its count off, the tiles with their pictures. */
const REPORTERS = list({
  variant: 'tiles',
  picture: 'art',
  picture_min: '32',
  max_rows: 5,
  show: 'all',
  show_count: false,
  hide_empty: false,
  tone: 'accent',
  card_border: true,
});

/**
 * What each card turns off besides its circle and its name, by its gallery frame: its line, its badge (`show_badge`,
 * or its own key for it), what trails its head (the "+", the "…" of an entity's details, the readouts a wide card sets
 * in it); the cards whose head is their title's keep the title and turn off their count.
 */
const QUIET: ReadonlyArray<readonly [frame: string, quiet: Record<string, unknown>]> = [
  ['actions', { subtitle: '' }],
  ['alarm', { subtitle: '', show_badge: false }],
  ['alarm · compact', { subtitle: '', show_badge: false }],
  ['alerts · rows', { show_count: false }],
  ['automations', { subtitle: '', show_add: false }],
  ['bars', { subtitle: '', show_badge: false }],
  ['batteries', { show_badge: false, subtitle: '' }],
  ['compass', { subtitle: '', show_badge: false }],
  ['compass · compact', { subtitle: '', show_badge: false }],
  ['cover', { subtitle: '', show_badge: false }],
  ['cover · compact', { subtitle: '', show_badge: false }],
  ['cover · horizontal', { subtitle: '', show_badge: false }],
  ['distribution', { subtitle: '', show_badge: false }],
  ['distribution · rows', { subtitle: '', show_badge: false }],
  ['energy · sources', { subtitle: '', entity: undefined }],
  ['energy · overview', { subtitle: '', entity: undefined }],
  ['energy-balance', { subtitle: '', show_badge: false }],
  ['energy-flow', { subtitle: '', badge: 'none' }],
  ['energy-sankey', { subtitle: '' }],
  ['energy-score', { subtitle: '' }],
  ['energy-usage', { subtitle: '', show_badge: false }],
  ['energy-usage · compact', { subtitle: '', show_badge: false }],
  ['energy-usage · mini', { subtitle: '', show_badge: false }],
  ['entities', { show_count: false, subtitle: '' }],
  ['gauge', { subtitle: '', show_badge: false }],
  ['gauge · bar', { subtitle: '', show_badge: false }],
  ['grid', { subtitle: '', show_badge: false }],
  ['helpers', { subtitle: '' }],
  ['history-bars', { subtitle: '', head: [] }],
  ['history-bars · compact', { subtitle: '', head: [] }],
  ['humidity', { subtitle: '', show_badge: false }],
  ['items', { show_count: false }],
  ['items · tiles', { show_count: false }],
  ['lock', { subtitle: '', show_badge: false }],
  ['lock · compact', { subtitle: '', show_badge: false }],
  ['openings', { subtitle: '', show_count: false }],
  ['production', { subtitle: '', show_badge: false }],
  ['production · compact', { subtitle: '', show_badge: false }],
  ['rounds', { show_count: false }],
  ['rounds · row', { show_count: false }],
  ['stat-tiles', { subtitle: '', show_badge: false }],
  ['thermostat', { subtitle: '', show_badge: false }],
  ['thermostat · compact', { subtitle: '', show_badge: false }],
  ['thermostats', { show_count: false, show_average: false }],
  ['todo', { subtitle: '', show_add: false }],
  ['updates', { subtitle: '', show_badge: false }],
  ['vacuum', { subtitle: '', show_badge: false }],
  ['vacuum · compact', { subtitle: '', show_badge: false }],
  ['web', { subtitle: '' }],
];

/** A config with a key asked away (`undefined`) taken out, as YAML would leave it. */
const written = (config: Record<string, unknown>): LovelaceCardConfig =>
  Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  ) as LovelaceCardConfig;

/**
 * A gallery example beside its twin with its head emptied; `more` set on both, a frame of its own named by what it
 * draws (`as`).
 */
function emptied(
  title: string,
  quiet: Record<string, unknown>,
  more?: { readonly as: string; readonly config: Record<string, unknown> },
): FrameSpec {
  const { cards, hass } = example(title);
  const card = { ...cards[0], ...more?.config } as LovelaceCardConfig & { cols?: number };
  return {
    title: `${title}${more ? ` · ${more.as}` : ''} · no head`,
    cards: [card, written({ ...card, ...quiet, ...EMPTY })],
    ...(hass ? { hass } : {}),
  };
}

const frames: FrameSpec[] = [
  // the reporter's, a full card: the tiles from the card's 20, the fold's row under them
  pair('Appliances · the reporter’s tiles', REPORTERS, {}, house),
  pair('Appliances · tiles', list({ variant: 'tiles' }), { show_count: false }, house),
  half('Appliances · rows', list(), { show_count: false }, house),
  half('Appliances · compact', list({ variant: 'compact' }), { subtitle: '' }, house),
  // nothing to list: the panel alone, its words wrapping in half a section as a headed card's do
  pair('Appliances · none', list({ appliances: [] }), { show_count: false }, house),
  // a phone's two cards: the door's lock and the blind, each beside its twin
  half('Lock · compact', example('lock · compact').cards[0] as LovelaceCardConfig, {
    subtitle: '',
    show_badge: false,
  }),
  half('Blind · compact', example('cover · compact').cards[0] as LovelaceCardConfig, {
    subtitle: '',
    show_badge: false,
  }),
  // every head a config can empty, the documentation's example beside it emptied
  ...QUIET.map(([title, quiet]) => emptied(title, quiet)),
  // the period's chips under the head, or with none the body's first part: at the card's 20 either way
  emptied(
    'energy-balance',
    { subtitle: '', show_badge: false },
    { as: 'a day', config: { period: 'day', show_cost: false } },
  ),
  emptied(
    'energy-flow',
    { subtitle: '', badge: 'none' },
    { as: 'a day', config: { period: 'day' } },
  ),
  emptied('energy-sankey', { subtitle: '' }, { as: 'no chips', config: { show_period: false } }),
  emptied('energy-score', { subtitle: '' }, { as: 'no chips', config: { show_period: false } }),
  emptied(
    'energy-usage',
    { subtitle: '', show_badge: false },
    { as: 'no chips', config: { show_period: false } },
  ),
];

export const sheet: SheetSpec = {
  states: [],
  on: [...(gallery.on ?? []), appliances],
  frames,
};
