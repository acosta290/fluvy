import { readStored, writeStored, type HomeAssistant, type LovelaceCardConfig } from '@fluvy/core';

/*
 * How a person left an expander, so it stands that way the next time the page opens. Where it is kept is the card's
 * `remember` key:
 * - `device` (the default): this browser only — a phone keeps folded what a wall tablet keeps open;
 * - `user`: Home Assistant's frontend user data, as the alerts' snoozes are — it follows the person to every device
 *   they sign in on (which cards are open is the person's state, not a setting: it is not in Fluvy's settings, and
 *   an export does not carry it);
 * - `off`: nothing is kept, the card opens as its config says.
 *
 * One table for a browser and one for a person, by the card's key (`expanderKey`). A card left as its config has it
 * is not kept at all, so a table holds only what was changed: the last `KEPT` of them.
 */

export const REMEMBER = ['device', 'user', 'off'] as const;
export type Remember = (typeof REMEMBER)[number];

/** The key of the table in this browser's storage, and in Home Assistant's frontend user data. */
export const DEVICE_KEY = 'fluvy:expanders';
export const USER_KEY = 'fluvy-expanders';

/** How many cards a table remembers: the oldest goes first. */
const KEPT = 200;

/** A card's key → whether it was left open. */
type Table = Readonly<Record<string, boolean>>;

/** A stored value read leniently: what is not a table is an empty one, an entry that is no switch is skipped. */
const parse = (raw: unknown): Table =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? Object.fromEntries(
        Object.entries(raw).filter(
          (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
        ),
      )
    : {};

/** The table with one card's entry replaced (`open`) or forgotten (undefined), the newest last, `KEPT` at most. */
function changed(table: Table, key: string, open: boolean | undefined): Table {
  const rest = Object.entries(table).filter(([own]) => own !== key);
  return Object.fromEntries(
    (open === undefined ? rest : [...rest, [key, open] as const]).slice(-KEPT),
  );
}

/** A short text of any length, as a key (FNV-1a, in base 36). */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * The key a card is remembered by: the view it stands on (the page's path), its head (its title and icon) and the
 * kinds of card it holds, and of those that stand as its head — so the same card on another view keeps its own, a
 * card given another title starts afresh, and two cards of one view told apart by neither share theirs. A card with
 * a name (`id`, #186) is remembered by the view and the name alone: whatever else of it changes it keeps its memory,
 * and the cards of one name, which open together, are remembered together.
 */
export function expanderKey(config: LovelaceCardConfig, path: string, name = ''): string {
  if (name) return hash(JSON.stringify([path, name]));
  const kinds = (key: string): string[] => {
    const cards: unknown = config[key];
    return Array.isArray(cards)
      ? cards.map((card: unknown) => String((card as LovelaceCardConfig | null)?.type))
      : [];
  };
  const heads = kinds('head_cards');
  return hash(
    JSON.stringify([
      path,
      config['title'],
      config['icon'],
      kinds('cards'),
      ...(heads.length ? [heads] : []),
    ]),
  );
}

/** What Home Assistant keeps for the person, read once a connection and kept as this page last wrote it. */
const tables = new WeakMap<object, Promise<Table>>();

/** The person's table as Home Assistant has it now; an empty one where it cannot be read. */
const read = (hass: HomeAssistant): Promise<Table> =>
  hass.callWS<{ value: unknown }>({ type: 'frontend/get_user_data', key: USER_KEY }).then(
    ({ value }) => parse(value),
    () => ({}),
  );

/**
 * Whether a card was left open: at once for this browser's, once Home Assistant answers for the person's; undefined
 * where nothing was kept (the card opens as its config says).
 */
export function recall(
  hass: HomeAssistant | undefined,
  scope: Remember,
  key: string,
): boolean | undefined | Promise<boolean | undefined> {
  if (scope === 'device') return parse(readStored(DEVICE_KEY))[key];
  if (scope === 'off' || !hass) return undefined;
  const connection: object = hass.connection;
  let table = tables.get(connection);
  if (!table) tables.set(connection, (table = read(hass)));
  return table.then((kept) => kept[key]);
}

/**
 * Keeps how a card was left (`open`), or forgets it (undefined: it is as its config says). The person's table is read
 * again first — another device may have written since this page opened, and a write replaces the table whole — and
 * one write waits for the one before it, so two cards folded one after the other are both kept.
 */
export function keep(
  hass: HomeAssistant | undefined,
  scope: Remember,
  key: string,
  open: boolean | undefined,
): void {
  if (scope === 'device')
    writeStored(DEVICE_KEY, changed(parse(readStored(DEVICE_KEY)), key, open));
  if (scope !== 'user' || !hass) return;
  const connection: object = hass.connection;
  tables.set(
    connection,
    Promise.resolve(tables.get(connection))
      .then(() => read(hass))
      .then(async (table) => {
        const value = changed(table, key, open);
        // refused or dropped: it is simply not remembered
        await hass
          .callWS({ type: 'frontend/set_user_data', key: USER_KEY, value })
          .catch(() => undefined);
        return value;
      }),
  );
}
