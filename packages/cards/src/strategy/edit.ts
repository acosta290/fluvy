import { domainOf } from '@fluvy/core';
import type { HomeRegistry } from './home-registry.js';
import type { Card, CardEdit, DashboardEdit, ListEdit, MoreHost, Part, Section } from './types.js';

/*
 * What a person changed on an automatic dashboard (`edit`, #170), kept as differences and never as a copy of what the
 * house holds: everything they did not touch stays automatic, and a device added later arrives where it belongs. Every
 * card a view lays out stands in a part under an id the generator gives it (`part`: `flow`, `lights`,
 * `room:<area id>`; the dashboard names it after its view's path, `home/flow`), never one read from its content, so
 * two alike cards or a renamed entity leave an edit where it was made. A part is hidden and given options as it is
 * built, a list's entities are left out, added and put in order before its cards are (`listed`), and a view's parts
 * are put in the person's order once its columns are cut (`arranged`).
 */

/** What a context must carry for its cards to stand in parts: the view being built (none: the cards as they are). */
type Hosted = { readonly more?: MoreHost };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const record = (value: unknown): Readonly<Record<string, unknown>> =>
  isRecord(value) ? value : {};
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/**
 * A dashboard's `edit`, well formed: the tables it has something in (`views`, `cards`, `entities`), each entry a table
 * of its own; anything else is no edit.
 */
export function editOf(raw: unknown): DashboardEdit {
  const edit: Record<string, unknown> = {};
  for (const table of ['views', 'cards', 'entities']) {
    const entries = Object.entries(record(record(raw)[table])).filter(([, own]) => isRecord(own));
    if (entries.length) edit[table] = Object.fromEntries(entries);
  }
  return edit;
}

/**
 * What a list takes of what a person adds to it (`edit.entities.<id>.add`), by its name, where that is more than the
 * domains it already holds: a tile draws any switch, a row any entity (`*`), a Scenes card what runs like a scene.
 */
export const TAKES: Readonly<Record<string, readonly string[]>> = {
  lights: ['light', 'switch', 'input_boolean'],
  appliances: ['switch', 'input_boolean', 'light'],
  security: ['*'],
  devices: ['*'],
  scenes: ['scene', 'script', 'automation'],
};

/** A part's own changes on the view being built. */
const cardEdit = (host: MoreHost, id: string): CardEdit | undefined =>
  host.edit.cards?.[`${host.path}/${id}`];

/** Whether a person hid this part of the view being built. */
export const hiddenPart = (ctx: Hosted, id: string): boolean =>
  ctx.more !== undefined && cardEdit(ctx.more, id)?.hidden === true;

/** The part each card stands in, by the card: its id inside its view. */
const PARTS = new WeakMap<Card, string>();
export const partOf = (card: Card): string | undefined => PARTS.get(card);

const HEADING = 'custom:fluvy-heading-card';

/** A card with a person's options over its config: a `null` takes a key away, and its type is never theirs to change. */
export function withOptions(card: Card, options: unknown): Card {
  if (!isRecord(options)) return card;
  const next: Record<string, unknown> = { ...card, ...options, type: card.type };
  for (const [key, value] of Object.entries(options)) if (value === null) delete next[key];
  return next as Card;
}

/**
 * The cards of one part of the view being built, under its id: none while the person hides it, else each with their
 * options — the part's over its own cards (all but a heading and a "N more" row that ride with them), then a card's
 * own where it draws one entity, room or device of a list (`home/lights:light.sofa`). Blocks and cards kept together
 * stay as they were handed.
 */
export function part<T extends Card | readonly Card[]>(
  ctx: Hosted,
  id: string,
  pieces: readonly T[],
): T[] {
  const host = ctx.more;
  if (!host) return [...pieces];
  const own = cardEdit(host, id);
  if (own?.hidden === true) {
    host.parts.push({ id, cards: [] });
    return [];
  }
  const cards = pieces.flat() as Card[];
  const main = (cards.find((card) => card.type !== HEADING) ?? cards[0])?.type;
  const dressed = (card: Card): Card => {
    const subject = card['entity'] ?? card['area'] ?? card['device'];
    const next = withOptions(
      card.type === main ? withOptions(card, own?.options) : card,
      typeof subject === 'string' ? cardEdit(host, `${id}:${subject}`)?.options : undefined,
    );
    PARTS.set(next, id);
    return next;
  };
  const built = pieces.map((piece) =>
    Array.isArray(piece) ? (piece as readonly Card[]).map(dressed) : dressed(piece as Card),
  ) as T[];
  host.parts.push({ id, cards: built.flat() as Card[] });
  return built;
}

/**
 * A list as a person left it (`edit.entities.<id>`): what they dropped gone, what they added after the house's — each
 * one the house has (`has`), of a domain the list takes — and what they put first, first. `order: false` gives it
 * before their order: what the order is counted from.
 */
export function edited(
  items: readonly string[],
  own: ListEdit | undefined,
  takes: readonly string[],
  has: (id: string) => boolean,
  order = true,
): readonly string[] {
  if (!own) return items;
  const drop = new Set(strings(own.drop));
  const kept = items.filter((item) => !drop.has(item));
  for (const item of strings(own.add))
    if (
      !drop.has(item) &&
      !kept.includes(item) &&
      has(item) &&
      (takes.includes('*') || takes.includes(domainOf(item)))
    )
      kept.push(item);
  const first = order ? strings(own.order) : [];
  const place = (item: string): number =>
    first.includes(item) ? first.indexOf(item) : first.length;
  return first.length ? kept.sort((a, b) => place(a) - place(b)) : kept;
}

/**
 * A list of the view being built as the person left it, before any card is made of it (`edited`). The house's own
 * list is kept on the view, for Customise to offer.
 */
export function listed(
  ctx: Hosted & { readonly home: HomeRegistry },
  id: string,
  items: readonly string[],
  about: {
    readonly takes?: readonly string[];
    readonly title?: string;
    readonly icon?: string;
  } = {},
): readonly string[] {
  const host = ctx.more;
  if (!host) return items;
  // what a person may add: the domains the list names, else the ones it already holds
  const takes = about.takes ?? [...new Set(items.map(domainOf))];
  host.lists.set(id, { ...about, items, takes });
  return edited(items, host.edit.entities?.[`${host.path}/${id}`], takes, (item) =>
    ctx.home.hasState(item),
  );
}

/**
 * `items` with the pinned ones on their places — `order` counts from the first (0, 1 …) or, negative, from the last
 * (-1) — and the others round them in their own order; two pinned to one place stand side by side.
 */
export function pinned<T>(items: readonly T[], order: (item: T) => unknown): T[] {
  const size = items.length;
  const pins = items
    .map((item) => ({ item, at: order(item) }))
    .filter((pin): pin is { item: T; at: number } => Number.isInteger(pin.at))
    .map(({ item, at }) => ({ item, at: Math.min(size - 1, Math.max(0, at < 0 ? size + at : at)) }))
    .sort((a, b) => a.at - b.at);
  if (!pins.length) return [...items];
  const moved = new Set(pins.map((pin) => pin.item));
  const rest = items.filter((item) => !moved.has(item));
  const placed: T[] = [];
  for (let at = 0; at < size; at++) {
    const pin = pins[0];
    // a pin stands on its place, or on the first one left once the others are too few to reach it
    if (pin && (pin.at <= at || !rest.length)) placed.push((pins.shift() as typeof pin).item);
    else placed.push(rest.shift() as T);
  }
  return placed;
}

/**
 * A view's sections with its parts in the person's order (`edit.cards.<id>.order`) and their own cards after them
 * (`edit.views.<path>.add`, each a part `own:<index>`). A part they moved joins the section of the part it now follows
 * (of the one it leads, when it is first), and among the view's columns it is laid as that one is — a block where
 * blocks are read, a card at the columns' feet among those — and the columns are cut again, level at the foot. A view
 * nobody ordered comes back as it was built.
 */
export function arranged(host: MoreHost, sections: readonly Section[]): Section[] {
  const own = host.edit.views?.[host.path]?.add;
  // each by its place in the list, whatever stands beside it: one that names no type is no card
  const added: Part[] = (Array.isArray(own) ? own : []).flatMap((card: unknown, index) => {
    if (!isRecord(card) || typeof card['type'] !== 'string' || !card['type']) return [];
    PARTS.set(card as Card, `own:${index}`);
    return [{ id: `own:${index}`, cards: [card as Card] }];
  });
  host.parts.push(...added);
  const moved = new Set(host.parts.filter((p) => Number.isInteger(cardEdit(host, p.id)?.order)));
  if (!moved.size && !added.length) return [...sections];

  const { flow } = host;
  const flowing = new Set(flow?.sections);
  /** Where each card stands as it was built: its section (none: the columns), and what it never splits from. */
  const places = new Map<Card, { readonly at: Section | undefined; readonly piece: unknown }>();
  for (const section of sections)
    if (!flowing.has(section))
      for (const card of section.cards) places.set(card, { at: section, piece: section });
  const blocks = new Set<unknown>(flow?.blocks);
  for (const piece of [...(flow?.blocks ?? []), ...(flow?.loose ?? [])])
    for (const card of Array.isArray(piece) ? (piece as readonly Card[]) : [piece as Card])
      places.set(card, { at: undefined, piece });
  // the person's own cards: among the columns' loose cards, else in the last section that is not a band
  const last = sections.filter((section) => !section.column_span).at(-1) ?? sections.at(-1);
  for (const { cards } of added)
    for (const card of cards) places.set(card, { at: flow ? undefined : last, piece: card });

  // every part has its place, drawn or not: hiding one never moves the others
  const order = pinned(host.parts, (p) => cardEdit(host, p.id)?.order).filter(
    (p) => p.cards.length,
  );
  // a part that leads takes after the first one that stayed where it was built
  const lead = (order.find((p) => !moved.has(p)) ?? order[0])?.cards[0];
  const start = lead && places.get(lead);
  let at = start?.at;
  let block = blocks.has(start?.piece);
  const fixed = new Map<Section, Card[]>();
  const pieces: { readonly cards: Card[]; readonly piece: unknown; readonly block: boolean }[] = [];
  for (const p of order) {
    const stays = !moved.has(p);
    for (const card of p.cards) {
      const place = places.get(card);
      if (!place) continue;
      if (stays) {
        at = place.at;
        if (!at) block = blocks.has(place.piece);
      }
      if (at) {
        fixed.set(at, [...(fixed.get(at) ?? []), card]);
        continue;
      }
      // a part that came from a section, or moved to the columns' feet, is one piece; a block keeps to its own
      const piece = place.at || (!stays && !block) ? p : place.piece;
      const before = pieces.at(-1);
      if (before && before.piece === piece) before.cards.push(card);
      // the first always leads its column
      else pieces.push({ cards: [card], piece, block: block || !pieces.length });
    }
  }
  const laid =
    flow?.lay(
      pieces.filter((piece) => piece.block).map((piece) => piece.cards),
      pieces.filter((piece) => !piece.block).map((piece) => piece.cards),
    ) ?? [];
  return sections.flatMap((section) =>
    flowing.has(section)
      ? section === flow?.sections[0]
        ? laid
        : []
      : [{ ...section, cards: fixed.get(section) ?? [] }],
  );
}
