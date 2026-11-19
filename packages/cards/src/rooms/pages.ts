import type { HomeAssistant } from '@fluvy/core';

/*
 * Where the house's rooms open (#225): each room's page on one of the house's automatic dashboards — Fluvy's Rooms
 * dashboard (`custom:fluvy-rooms`: a room's page behind its card, or its tab), else Home (`custom:fluvy-home`, while
 * it keeps its Rooms view) — found once a page from the configurations of the dashboards that may be one: the
 * dashboard the card stands on, and those Fluvy's settings make (their paths begin with `fluvy-`). Read as anyone
 * reads a dashboard; nothing is written.
 */

/** A dashboard the house's rooms open on: a room's page under it (`<base>/room-<area>`), and the page of them all. */
export interface RoomsDashboard {
  /** Its path (`/fluvy-rooms`). */
  readonly base: string;
  /** Where every room is: the Rooms dashboard's first view, Home's Rooms view (`/fluvy-auto/rooms`). */
  readonly all: string;
}

type Strategy = Readonly<Record<string, unknown>> | undefined;

/**
 * How well a dashboard opens the rooms, by its strategy: the Rooms dashboard first (0), then Home where it keeps its
 * Rooms view, neither left out by its options (`hide`) nor hidden in Customise (`edit`); -1, none.
 */
function rankOf(strategy: Strategy): number {
  if (strategy?.['type'] === 'custom:fluvy-rooms') return 0;
  if (strategy?.['type'] !== 'custom:fluvy-home') return -1;
  const hide = strategy['hide'];
  const edit = strategy['edit'] as { views?: { rooms?: { hidden?: unknown } } } | undefined;
  return (Array.isArray(hide) && hide.includes('rooms')) || edit?.views?.rooms?.hidden === true
    ? -1
    : 1;
}

/**
 * The dashboard the rooms open on, of those this person's frontend lists that may be one: the page's own first, then
 * the Rooms dashboard before Home; none where no dashboard opens them, or none answers.
 */
async function find(hass: HomeAssistant, here: string): Promise<RoomsDashboard | null> {
  const paths = Object.values(hass.panels ?? {})
    .filter(
      (panel) =>
        panel.component_name === 'lovelace' &&
        Boolean(panel.url_path) &&
        (panel.url_path === here || panel.url_path.startsWith('fluvy-')),
    )
    .map((panel) => panel.url_path);
  const strategies = await Promise.all(
    paths.map((path) =>
      hass
        .callWS<{ strategy?: Strategy }>({
          type: 'lovelace/config',
          url_path: path === 'lovelace' ? null : path,
        })
        .then(
          (config) => config?.strategy,
          () => undefined,
        ),
    ),
  );
  const best = paths
    .map((path, index) => ({ path, rank: rankOf(strategies[index]) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => Number(b.path === here) - Number(a.path === here) || a.rank - b.rank)[0];
  return best
    ? { base: `/${best.path}`, all: best.rank ? `/${best.path}/rooms` : `/${best.path}` }
    : null;
}

/** The last read: the panels and the page it was read for, and its answer once it has one. */
let read:
  | {
      readonly panels: object;
      readonly here: string;
      readonly answer: Promise<RoomsDashboard | null>;
      found?: RoomsDashboard | null;
    }
  | undefined;

/**
 * The dashboard the house's rooms open on (`null`: none), read once a page and again when the house's dashboards or
 * the page change; undefined while it is read, the card drawn again (`redraw`) once it is.
 */
export function roomsDashboard(
  hass: HomeAssistant | undefined,
  redraw: () => void,
): RoomsDashboard | null | undefined {
  const panels = hass?.panels;
  if (!hass?.callWS || !panels) return null;
  const here = location.pathname.split('/')[1] ?? '';
  if (read?.panels !== panels || read.here !== here) {
    const answer = find(hass, here);
    const entry: NonNullable<typeof read> = { panels, here, answer };
    read = entry;
    void answer.then((found) => (entry.found = found));
  }
  if (read.found !== undefined) return read.found;
  void read.answer.then(redraw);
  return undefined;
}
