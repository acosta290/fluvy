import { deviceNameOf, type HomeAssistant, registryText } from '@fluvy/core';
import { generateWith } from '../../strategy/generate.js';
import type { Template } from '../../strategy/templates.js';
import type { Card, FluvyStrategyConfig, MoreHost, PartList } from '../../strategy/types.js';

/*
 * An automatic dashboard as Customise lists it (#170): its views as the house builds them — never as a person left
 * them, so a view or a card they hid is still there to show again — each with its parts in the order they are read,
 * and each part with its cards, its list and what its row says.
 */

/** A part of a view as its row shows it. */
export interface PartOutline {
  /** Its id as the dashboard's `edit` names it (`home/lights`). */
  readonly id: string;
  /** What it is, the first word of its own id (`lights`, `room`, `flow`). */
  readonly kind: string;
  /** Its cards as the house builds them: none while the house has nothing for it (it keeps its place all the same). */
  readonly cards: readonly Card[];
  /** The card its options are edited on: its first that is no heading. */
  readonly card: Card | undefined;
  /** The list it draws, where it draws one. */
  readonly list: PartList | undefined;
}

export interface ViewOutline {
  /** Its path, which is its id in the dashboard's `edit`. */
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  /** A tab of the dashboard; else a page reached from one (a room's, every appliance's). */
  readonly tab: boolean;
  readonly parts: readonly PartOutline[];
}

const HEADING = 'custom:fluvy-heading-card';

/** A dashboard's strategy without what a person changed on it. */
export const automatic = (strategy: Readonly<Record<string, unknown>>): FluvyStrategyConfig =>
  Object.fromEntries(
    Object.entries(strategy).filter(([key]) => key !== 'edit'),
  ) as unknown as FluvyStrategyConfig;

/** The views of a dashboard the house draws, each with its parts; the tabs first, in the template's order. */
export async function outlineOf(
  template: Template,
  strategy: Readonly<Record<string, unknown>>,
  hass: HomeAssistant,
  urlPath: string,
): Promise<ViewOutline[]> {
  const hosts: MoreHost[] = [];
  const { views } = await generateWith(template, automatic(strategy), hass, `/${urlPath}`, hosts);
  return hosts.flatMap((host) => {
    const view = views.find((candidate) => candidate.path === host.path);
    if (!view) return [];
    return [
      {
        id: host.path,
        title: host.title,
        icon: host.icon,
        tab: !view.subview,
        parts: host.parts.map(({ id, cards }) => ({
          id: `${host.path}/${id}`,
          kind: id.split(':')[0] as string,
          cards,
          card: cards.find((card) => card.type !== HEADING) ?? cards[0],
          list: host.lists.get(id),
        })),
      },
    ];
  });
}

/** What a card is about: the entity, the room or the device it draws, where it draws one. */
export const subjectOf = (card: Card | undefined): string | undefined => {
  const subject = card?.['entity'] ?? card?.['area'] ?? card?.['device'];
  return typeof subject === 'string' ? subject : undefined;
};

/** The card a list draws for one of its items alone (a light's tile, a thermostat), where it draws one. */
export const itemCard = (part: PartOutline, item: string): Card | undefined =>
  part.cards.find((card) => subjectOf(card) === item);

/** The key of a card's config that holds a list's items: what Customise edits itself, never the card's form. */
export function listKey(card: Card | undefined, list: PartList | undefined): string | undefined {
  if (!card || !list) return undefined;
  const items = new Set(list.items);
  const named = (entry: unknown): boolean =>
    typeof entry === 'string'
      ? items.has(entry)
      : typeof entry === 'object' && entry !== null && items.has(String(subjectOf(entry as Card)));
  return Object.keys(card).find((key) => {
    const value = card[key];
    return Array.isArray(value) && value.length > 0 && value.some(named);
  });
}

/** A name the house gives: an entity's, a room's, a device's. */
export function nameOf(hass: HomeAssistant, id: string): string {
  const state = hass.states[id];
  if (state) return registryText(state.attributes['friendly_name']) ?? id;
  return registryText(hass.areas?.[id]?.name) ?? deviceNameOf(hass.devices?.[id]) ?? id;
}

/** A glyph for what a part is, where it is neither a list (it brings its own) nor of one entity. */
const GLYPHS: Readonly<Record<string, string>> = {
  attention: 'warn',
  thermostat: 'thermo',
  weather: 'cloudSun',
  clock: 'clock',
  flow: 'bolt',
  curve: 'chart',
  media: 'speaker',
  vacuum: 'vacuum',
  printer: 'printer3d',
  todo: 'list',
  room: 'rooms',
  floor: 'home',
  back: 'chevronLeft',
  balance: 'swap',
  sources: 'chart',
  grid: 'tower',
  grid_gauge: 'tower',
  batteries: 'battery',
  charger: 'car',
  day_flow: 'bolt',
  sankey: 'nodes',
  score: 'leaf',
  day_balance: 'swap',
  gauges: 'sun',
  production: 'sun',
  tomorrow: 'sun',
  history: 'chart',
  distribution: 'chart',
  water: 'drop',
  period: 'calendar',
  usage: 'chart',
  usage_water: 'drop',
  usage_gas: 'flame',
  people: 'person',
  map: 'map',
  openings: 'door',
  camera: 'camera',
  hello: 'person',
  scenes: 'sparkle',
  automations: 'automation',
  own: 'code',
};

/** The icon of a part's row: its list's, its card's own, its room's, else the glyph of what it is. */
export function iconOf(part: PartOutline, hass: HomeAssistant): string {
  const own = part.card?.['icon'];
  return (
    part.list?.icon ||
    (typeof own === 'string' && own) ||
    hass.areas?.[subjectOf(part.card) ?? '']?.icon ||
    GLYPHS[part.kind] ||
    'grid'
  );
}
