/*
 * A dashboard's own sidebar on the playground's dashboard (`?dashboard=sidebar&side=…`, 1.21, #187): the
 * `fluvy_sidebar:` a page asks for, as a dashboard's configuration would write it beside `views:`. The cards read the
 * `sidebar` sheet's house (`sheets/sidebar.ts`).
 *
 *   &side=menu     a clock at the head, the dashboard's views as the menu, the alerts at the foot (the wall tablet's)
 *   &side=long     the same with more in the middle than a window holds: the middle scrolls, the head and the foot stay
 *   &side=cards    cards alone, no menu: Fluvy's and one of Home Assistant's own
 *   &side=drawer   `menu`, in a drawer on a phone (`phone: drawer`)
 *   &side=tallhead the head holds the house behind an open Expander, taller than a window: the whole column scrolls
 *                  inside its surface, never the page (#195; `&sidephone=drawer` the same in a phone's drawer)
 *   &side=tallfoot the same at the foot, over the alerts
 *   &side=folded   `menu` with the house folded in the middle, under the menu: a tap opens it, and the middle fades
 *   &side=short    pinned head and foot on a short tablet (#211; a wall's 1024 × 600): the clock and the weather at
 *                  the head, the player and the alerts at the foot, leaving the middle less than a row and still the
 *                  middle alone scrolls
 *   &side=pages    a menu of pages written by hand: an address, a view by its path, an action
 *   &sidepos=end  &sidestyle=card|plain  &sidephone=top|drawer  &sidefold=1 (collapsible)  &sidetabs=0 (hide_tabs)
 *   &sidepinned=1 (the menu stays under the head)  &sidewidth=24%  &sideviews=home,rooms  &sidesub=0  &sideusers=…
 *   &sideopacity=70  ·  &sidebar={…} a configuration of the page's own, as JSON
 */

const CLOCK = {
  type: 'custom:fluvy-clock-card',
  face: 'digital',
  weather: 'weather.home',
  show_forecast: false,
};

/** What needs a look, in one line that says the gravest and how many more. */
const ALERTS = {
  type: 'custom:fluvy-alerts-card',
  variant: 'banner',
  rotate: 0,
  alerts: [
    { preset: 'hazards' },
    { preset: 'open' },
    { preset: 'unlocked' },
    { preset: 'low_battery' },
  ],
};

const THERMOSTAT = {
  type: 'custom:fluvy-thermostat-card',
  entity: 'climate.living',
  variant: 'compact',
};

const LIGHTS = {
  type: 'custom:fluvy-tiles-card',
  size: 'compact',
  columns: 1,
  entities: ['light.ceiling', 'light.reading', 'switch.desk_plug'],
};

const PLAYER = { type: 'custom:fluvy-media-card', entity: 'media_player.living', variant: 'mini' };

/** The weather beside the clock: today's line and the next two days. */
const WEATHER = { type: 'custom:fluvy-weather-card', entity: 'weather.home', variant: 'compact' };

/** One of Home Assistant's own cards, as its wrapper builds it. */
const ENTITIES = {
  type: 'entities',
  entities: ['sensor.living_temperature', 'sensor.living_humidity', 'switch.kitchen'],
};

const MENU = { items: 'views' };

const EXPANDER = 'custom:fluvy-expander-card';

/** The rest of the house's switches, as the tiles show them. */
const SWITCHES = {
  type: 'custom:fluvy-tiles-card',
  size: 'compact',
  columns: 1,
  entities: ['switch.kitchen', 'switch.hall', 'switch.office', 'switch.patio', 'cover.blinds'],
};

/** Every light, switch and reading of the house behind one fold, open: taller than a window wherever it stands (#195). */
const HOUSE = {
  type: EXPANDER,
  title: 'Around the house',
  icon: 'fluvy:home',
  expanded: true,
  remember: 'off',
  cards: [LIGHTS, SWITCHES, THERMOSTAT, ENTITIES],
};

/** The same, folded: what the middle holds until a tap opens it. */
const FOLDED = { ...HOUSE, expanded: false };

const SIDES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  menu: { header: { cards: [CLOCK] }, menu: MENU, footer: { cards: [ALERTS] } },
  long: {
    header: { cards: [CLOCK] },
    menu: MENU,
    cards: [THERMOSTAT, LIGHTS, PLAYER, ENTITIES],
    footer: { cards: [ALERTS] },
  },
  cards: { header: { cards: [CLOCK] }, cards: [THERMOSTAT, ENTITIES], footer: { cards: [ALERTS] } },
  drawer: {
    header: { cards: [CLOCK] },
    menu: MENU,
    cards: [THERMOSTAT],
    footer: { cards: [ALERTS] },
    phone: 'drawer',
  },
  tallhead: { header: { cards: [CLOCK, HOUSE] }, menu: MENU, footer: { cards: [ALERTS] } },
  tallfoot: { header: { cards: [CLOCK] }, menu: MENU, footer: { cards: [HOUSE, ALERTS] } },
  folded: {
    header: { cards: [CLOCK] },
    menu: MENU,
    cards: [FOLDED],
    footer: { cards: [ALERTS] },
  },
  short: {
    header: { cards: [CLOCK, WEATHER] },
    menu: MENU,
    cards: [FOLDED],
    footer: { cards: [PLAYER, ALERTS] },
  },
  pages: {
    menu: {
      items: [
        { title: 'Home', icon: 'fluvy:home', path: '/fluvy-home/home' },
        { title: 'Lights', path: 'lights' },
        { title: 'Energy', icon: 'mdi:flash', path: '/fluvy-home/energy' },
        {
          title: 'All lights off',
          icon: 'fluvy:power',
          tap_action: { action: 'perform-action', perform_action: 'light.turn_off' },
        },
        // neither an address nor an action: left out
        { title: 'Elsewhere', path: 'https://example.com/' },
      ],
    },
  },
};

/** A JSON parameter, nothing where it is not one. */
const json = (text: string | null): unknown => {
  try {
    return text === null ? undefined : (JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
};

/** The sidebar a page asks for, as its dashboard would write it; undefined where it asks for none. */
export function sidebarFor(params: URLSearchParams): unknown {
  const own = json(params.get('sidebar'));
  if (own !== undefined) return own;
  const base = SIDES[params.get('side') ?? ''];
  if (!base) return undefined;
  const list = (name: string): string[] | undefined => params.get(name)?.split(',').filter(Boolean);
  const width = params.get('sidewidth');
  return {
    ...base,
    ...(params.has('sidepos') ? { position: params.get('sidepos') } : {}),
    ...(params.has('sidestyle') ? { style: params.get('sidestyle') } : {}),
    ...(params.has('sidephone') ? { phone: params.get('sidephone') } : {}),
    ...(params.get('sidefold') === '1' ? { collapsible: true } : {}),
    ...(params.get('sidetabs') === '0' ? { hide_tabs: true } : {}),
    ...(params.get('sidepinned') === '1' ? { menu: { ...MENU, pinned: true } } : {}),
    ...(width ? { width: json(width) ?? width } : {}),
    ...(params.has('sideviews') ? { views: list('sideviews') } : {}),
    ...(params.get('sidesub') === '0' ? { subviews: false } : {}),
    ...(params.has('sideusers') ? { users: list('sideusers') } : {}),
    ...(params.has('sideopacity') ? { card_opacity: Number(params.get('sideopacity')) } : {}),
  };
}
