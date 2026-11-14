import {
  DEMO_AREAS,
  DEMO_DASHBOARDS,
  DEMO_ENERGY_SOURCES,
  DEMO_EXTRAS,
  DEMO_FLOORS,
  DEMO_ROOMS,
  demoHass,
} from '@fluvy/demo-home';
import { COMMUNITY_PALETTES } from '@fluvy/tokens/community';
import '@fluvy/cards/panel';
import {
  CHART_DEFAULTS,
  WALL_DEFAULTS,
  writeDevice,
  type HassEntity,
  type HomeAssistant,
  type Look,
  type LookHandle,
  type SavedSeries,
} from '@fluvy/core';
import { defineFormStub } from './ha-form.js';
import { defineSelectorStub } from './ha-selector.js';
import { createMemoryLook, type MemoryLook } from './look-memory.js';

/**
 * A moment of the panel to look at, `?state=`: a look chosen but not applied (`pending`), a custom palette
 * being made (`custom`), someone who is not an administrator (`guest`), a house without the automatic
 * dashboard (`missing`), Reset armed (`armed`), the notice after a save (`saved`), a person wearing their own
 * look (`own`), the look on the whole of Home Assistant (`everywhere`, with the frame), a look tried on the whole
 * app with nothing changed (`trial`), a profile that chose the Fluvy theme (`themed`) or Fluvy Dark (`themed-dark`),
 * the house's default theme Fluvy Light (`house-light`), edits on the other tabs
 * waiting to be saved (`edits`), the language menu open (`menu`), every template's dashboard created, the home's
 * leaving out a water heater and the inverter's MPPT readings (`dashboards`), a dashboard's Recreate row armed
 * (`recreate`), this browser a wall panel (`wall`), read at 125 % with its screensaver at that size too (`sized`,
 * #190), three palettes saved by the house (`palettes`), the wall dark
 * with a veil on the mesh (`night`), a warning of the house's own saved and a danger in its very colour waiting
 * (`statuses`), the house's charts in the soft style with a gauge that moves (`styled`: every fine row, its waves
 * too), three sets of series colours kept by the house, the second worn (`sets`), a new set being made with two
 * colours too close, one too pale for a light card, which it wears deepened, and two of the palette's, the first
 * being picked (`editor`), the house's cards see-through at 80 % (`glass`). The home dashboard being customised
 * (`customise`, #170: on the demo home, opened by its address), with changes waiting — a card hidden, one moved first,
 * a light left out of a list and a switch added to it, a view hidden (`changes`) — with what was saved before
 * (`customised`: the clock as an analogue one, a room put first), its lights unfolded to their entities (`list`), the
 * clock's options in their sheet (`sheet`). The house's rooms in an order of its own, the home dashboard grouping by
 * room and drawing its scenes as chips (`rooms`, #189: with `dashboards`). And 1.21's (#188): the tabs unfolded under
 * the view's place among them (`tabs`), a row lifted on its way up the list (`drag`: the scenes, as a mouse or a
 * finger holds them), the kitchen's and the living room's scenes shown on Home as well and put first (`centre`: a
 * command centre of the rooms' scenes), the sheet "Add a card" on the dashboard's own cards with two of them picked
 * (`add`), on Fluvy's cards (`cards`) and on one of them in its own form, drawn over it (`new`); and, without the
 * panel, what Home Assistant's pencil opens on the dashboard (`pencil`: its "Edit dashboard" dialog with the
 * strategy's form). Several join with commas.
 */
export type PanelState =
  | 'pending'
  | 'custom'
  | 'guest'
  | 'missing'
  | 'armed'
  | 'saved'
  | 'own'
  | 'everywhere'
  | 'trial'
  | 'themed'
  | 'themed-dark'
  | 'house-light'
  | 'edits'
  | 'menu'
  | 'dashboards'
  | 'recreate'
  | 'wall'
  | 'sized'
  | 'palettes'
  | 'night'
  | 'statuses'
  | 'styled'
  | 'sets'
  | 'editor'
  | 'glass'
  | 'customise'
  | 'changes'
  | 'customised'
  | 'list'
  | 'sheet'
  | 'rooms'
  | 'tabs'
  | 'drag'
  | 'centre'
  | 'add'
  | 'cards'
  | 'new'
  | 'pencil';

/**
 * Three sets of series colours a house might keep: the earth's, which follows the palette (its colours named), the
 * sea's and an evening's (hexes, fixed).
 */
const SETS: readonly SavedSeries[] = [
  {
    id: 'garden',
    name: 'Garden',
    colours: ['graph-4', 'solar', 'graph-6', 'ok', 'water', 'graph-2'],
  },
  {
    id: 'sea',
    name: 'Sea',
    colours: ['#1d4ed8', '#0f766e', '#7c3aed', '#0e7490', '#be185d', '#4d7c0f'],
  },
  {
    id: 'evening',
    name: 'Evening',
    colours: ['#c2410c', '#9d174d', '#6d28d9', '#b45309', '#1e40af', '#047857'],
  },
];

/** The dashboards our templates create, as the panel would (the home's is `fluvy-auto` in the demo home already). */
const TEMPLATE_DASHBOARDS = [
  {
    url_path: 'fluvy-rooms',
    title: 'Fluvy · Rooms',
    icon: 'fluvy:rooms',
    type: 'custom:fluvy-rooms',
  },
  {
    url_path: 'fluvy-energy',
    title: 'Fluvy · Energy',
    icon: 'fluvy:bolt',
    type: 'custom:fluvy-energy',
  },
  {
    url_path: 'fluvy-security',
    title: 'Fluvy · Security',
    icon: 'fluvy:shield',
    type: 'custom:fluvy-security',
  },
  { url_path: 'fluvy-wall', title: 'Fluvy · Wall', icon: 'fluvy:frame', type: 'custom:fluvy-wall' },
] as const;
/** The template dashboards this page has (created by the state, or by the panel's Create). */
const created = new Map<string, (typeof TEMPLATE_DASHBOARDS)[number]>();
/** Tells the mounted panel the dashboards changed (Home Assistant hands a new `panels` in that case). */
let onPanels: (() => void) | undefined;

/**
 * The settings panel outside Home Assistant: `?panel=appearance` (or scope, dashboard, wall, preferences).
 * Its settings live in memory behind the same websocket messages Home Assistant answers, and the live
 * look engine applies them to this page — what the panel does here is what it does at home. A page that already
 * runs on a `MemoryLook` (the demo) hands it over, so the panel shows that page's settings.
 */
export function mountPanel(
  stage: HTMLElement,
  hass: HomeAssistant,
  tab: string,
  dark: boolean,
  states: readonly PanelState[] = [],
  look: MemoryLook = createMemoryLook(document, dark),
): { panel: HTMLElement; look: MemoryLook } {
  const has = (state: PanelState): boolean => states.includes(state);
  created.clear();
  if (has('dashboards')) {
    for (const dashboard of TEMPLATE_DASHBOARDS) created.set(dashboard.url_path, dashboard);
    configs.set('fluvy-auto', {
      strategy: {
        type: 'custom:fluvy-home',
        exclude: ['water_heater.tank', 'sensor.inverter_mppt_*'],
      },
    });
    // the wall's "rooms shown" are the house's areas: the demo home's, on this page; the water heater the home leaves
    // out is the house's own, named
    hass = {
      ...hass,
      areas: Object.fromEntries(DEMO_AREAS.map((area) => [area.area_id, { ...area }])),
      states: {
        ...hass.states,
        'water_heater.tank': {
          entity_id: 'water_heater.tank',
          state: 'eco',
          attributes: { friendly_name: 'Water heater' },
          last_changed: '2026-09-17T19:47:00Z',
          last_updated: '2026-09-17T19:47:00Z',
        } as HassEntity,
      },
    } as HomeAssistant;
  }
  // the home dashboard by room, its scenes as chips, and the floors its rooms are on (#189)
  if (has('rooms')) {
    configs.set('fluvy-auto', {
      strategy: { type: 'custom:fluvy-home', group_by: 'room', scenes_style: 'chips' },
    });
    hass = {
      ...hass,
      floors: Object.fromEntries(DEMO_FLOORS.map((floor) => [floor.floor_id, { ...floor }])),
    } as HomeAssistant;
  }
  // Customise reads a whole house: the demo home's, with its rooms, its energy and one of everything
  demoHome = has('customise');
  if (demoHome) hass = withDemoHome(hass);
  if (has('customised'))
    configs.set('fluvy-auto', { strategy: { type: 'custom:fluvy-home', edit: SAVED_EDIT } });
  if (has('centre'))
    configs.set('fluvy-auto', { strategy: { type: 'custom:fluvy-home', edit: CENTRE_EDIT } });
  // two sensors that see a person, so the Screen card offers its wake-on-motion dropdown (a room as the hint)
  if (has('wall')) hass = withMotionSensors(hass);
  // the dashboards as Home Assistant hands them to every frontend (its own Overview, the house's, maybe ours)
  hass = { ...hass, panels: panelsFor(states) } as HomeAssistant;
  if (has('guest')) hass = { ...hass, user: { ...hass.user, is_admin: false } } as HomeAssistant;
  if (has('themed'))
    hass = {
      ...hass,
      selectedTheme: { theme: 'Fluvy' },
      themes: { ...hass.themes, theme: 'Fluvy' },
    } as HomeAssistant;
  // Home Assistant holds a theme of one mode to it: Fluvy Dark is dark whatever the profile's mode says
  if (has('themed-dark'))
    hass = {
      ...hass,
      selectedTheme: { theme: 'Fluvy Dark' },
      themes: { ...hass.themes, theme: 'Fluvy Dark', darkMode: true },
    } as HomeAssistant;
  if (has('house-light'))
    hass = {
      ...hass,
      themes: {
        ...hass.themes,
        default_theme: 'Fluvy Light',
        theme: 'Fluvy Light',
        darkMode: false,
      },
    } as HomeAssistant;
  const { handle } = look;
  const { store } = handle;

  if (has('own')) void store.savePersonal({ palette: 'blaze', shape: 'round' });
  // three palettes the house keeps (the community's, renamed, so "Yours" shows apart from "Community")
  if (has('palettes'))
    void store.saveHouse({
      palettes: COMMUNITY_PALETTES.map((file) => ({
        ...file,
        name: `ours-${file.name}`,
        title: `Our ${file.title.toLowerCase()}`,
        author: 'Marta',
      })),
    });
  if (has('everywhere')) void store.saveHouse({ scope: 'everywhere', frame: true });
  // #47's orange as the house's warning
  if (has('statuses')) void store.saveHouse({ statuses: { warning: '#dc630b' } });
  // the house's charts in the soft style with the liquid for its gauge (every fine row they act on, the waves too), and
  // its own sets of series colours, Sea worn
  if (has('styled') || has('sets'))
    void store.saveHouse({
      charts: {
        ...CHART_DEFAULTS,
        ...(has('styled') ? { style: 'soft' as const, gauge: 'liquid' as const } : {}),
        ...(has('sets') ? { series: 'sea' } : {}),
      },
      ...(has('sets') ? { chartSets: SETS } : {}),
    });
  // the house's rooms in an order of its own: the kitchen first, then the living room (#189)
  if (has('rooms'))
    void store.saveHouse({
      rooms: { sort: 'auto', order: ['kitchen', 'living_room', 'bedroom', 'garden'] },
    });
  // every card see-through at 80 %, what shows through blurred (the appearance preview on its picture)
  if (has('glass'))
    void store.saveHouse({
      cards: { opacity: 80, blur: true, unavailable: 'dashed', border: true },
    });
  // the wall at night: always dark, veiled at 40 %, on the mesh (the tab's preview shows it so)
  if (has('night'))
    void store.saveHouse({
      wall: { ...WALL_DEFAULTS, theme: 'dark', nightDim: 40, background: 'wall' },
    });

  // what this browser is: the panel reads its memory when it is made
  writeDevice({
    wall: has('wall'),
    ...(has('sized') ? { zoom: 125 as const, screensaverZoom: true } : {}),
  });
  const panel = document.createElement('fluvy-panel') as HTMLElement & {
    hass: HomeAssistant;
    handle: LookHandle;
    route: { prefix: string; path: string };
    narrow: boolean;
    draft: Look | undefined;
    resetArmed: boolean;
    recreateArmed: string;
    tryOnApp: boolean;
    houseEdit: Record<string, unknown>;
    personalEdit: Record<string, unknown>;
    strategyEdits: Record<string, unknown>;
    seriesDraft: unknown;
    notice: string;
    updateComplete: Promise<boolean>;
  };
  panel.handle = handle;
  // Customise is opened as a link to it opens it: the dashboard's url path after the tab's
  panel.route = { prefix: '/fluvy', path: has('customise') ? '/dashboard/fluvy-auto' : `/${tab}` };
  panel.narrow = window.innerWidth < 870;
  panel.hass = hass;
  onPanels = () => {
    panel.hass = { ...panel.hass, panels: panelsFor(states) } as HomeAssistant;
  };
  stage.classList.add('pg-panel');
  // the Dashboards tab's entity picker is Home Assistant's, and so is the form a card's options are edited in
  defineSelectorStub();
  if (has('customise')) defineFormStub();
  stage.append(panel);
  // the moment asked for, once the panel has its settings
  setTimeout(() => {
    if (has('pending')) panel.draft = { palette: 'volt', shape: 'round', pills: 'round' };
    if (has('custom'))
      panel.draft = {
        palette: {
          character: 'vivid',
          base: 'cool',
          accent: '#ff4a1a',
          fill: 'solid',
          highlight: '#e2ff3d',
        },
        shape: 'soft',
        pills: 'round',
      };
    if (has('armed')) panel.resetArmed = true;
    if (has('recreate')) panel.recreateArmed = 'fluvy-auto';
    if (has('trial')) panel.tryOnApp = true;
    if (has('edits')) {
      panel.houseEdit = { frame: false };
      panel.personalEdit = { haptics: false };
    }
    // a danger in the warning's very colour, not saved yet: the panel says the two are close
    if (has('statuses')) panel.houseEdit = { statuses: { warning: '#dc630b', danger: '#dc630b' } };
    // a set being made: two blues a breath apart (said), the palette's third series colour and its solar (they follow
    // the palette), a cream the light card wears deepened and a purple the dark one wears lifted (fitted, nothing to
    // say); the third is being picked
    if (has('editor'))
      panel.seriesDraft = {
        name: 'Dusk',
        colours: ['#1d4ed8', '#1f52dc', 'graph-3', 'solar', '#f4e9d0', '#7e22ce'],
        slot: 2,
      };
    if (has('changes'))
      panel.strategyEdits = {
        'fluvy-auto': { edit: { ...(has('customised') ? SAVED_EDIT : {}), ...PENDING_EDIT } },
      };
    if (has('list') || has('sheet')) setTimeout(() => void unfold(panel, has('sheet')), 400);
    const moment = (['tabs', 'drag', 'add', 'cards', 'new'] as const).find(has);
    if (moment) setTimeout(() => void MOMENTS[moment](panel), 400);
    if (has('saved')) panel.notice = hass.language === 'es' ? 'Guardado' : 'Saved';
    if (has('menu'))
      void panel.updateComplete.then(() => {
        const select = panel.shadowRoot?.querySelector('fluvy-select');
        if (select) select.open = true;
      });
  }, 50);
  return { panel, look };
}

/** What a person saved on the home dashboard before: the clock as an analogue one, the garden's card first. */
const SAVED_EDIT = {
  cards: {
    'home/clock': { options: { face: 'analog' } },
    'rooms/room:garden': { order: 0 },
  },
};
/**
 * What waits in the bar: the weather hidden, the energy flow read second, the patio's light left out of Home's lights
 * and the fan's switch added to them, the Media view hidden.
 */
const PENDING_EDIT = {
  views: { media: { hidden: true } },
  cards: {
    ...SAVED_EDIT.cards,
    'home/weather': { hidden: true },
    'home/flow': { order: 1 },
  },
  entities: {
    'home/lights': { drop: ['switch.patio_light'], add: ['switch.washing_machine_outlet'] },
  },
};

/**
 * A command centre on Home (#188): the kitchen's and the living room's scenes shown there as well, read first and
 * second, each still its room's own card and titled here after its room.
 */
const CENTRE_EDIT = {
  views: { home: { also: ['room-kitchen/scenes', 'room-living_room/scenes'] } },
  cards: {
    'home/also:room-kitchen/scenes': { order: 0, options: { title: 'Kitchen' } },
    'home/also:room-living_room/scenes': { order: 1, options: { title: 'Living room' } },
  },
};

/** The rooms' own scenes of the house Customise reads: what a person brings to Home as a command centre. */
const ROOM_SCENES = [
  ['scene.kitchen_cooking', 'Cooking', 'kitchen'],
  ['scene.kitchen_dinner', 'Dinner', 'kitchen'],
  ['scene.kitchen_cleaning_up', 'Cleaning up', 'kitchen'],
  ['scene.living_room_reading', 'Reading', 'living_room'],
  ['scene.living_room_film', 'Film night', 'living_room'],
] as const;

/** Whether the page's house is the demo home (the energy preferences are then its own). */
let demoHome = false;

/** A name the demo home left as its entity's id (`heat_pump`), as a person would write it ("Heat pump"). */
const named = (name: unknown): { friendly_name?: string } =>
  typeof name === 'string' && /^[a-z0-9_]+$/.test(name)
    ? { friendly_name: (name[0]?.toUpperCase() ?? '') + name.slice(1).replace(/_/g, ' ') }
    : {};

/** The house as the demo home: its rooms, floors and devices, its entities over the page's own. */
function withDemoHome(hass: HomeAssistant): HomeAssistant {
  const demo = demoHass({
    more: [
      ...DEMO_EXTRAS,
      ...DEMO_ROOMS,
      ...ROOM_SCENES.map(([id, name, area]) => ({
        id,
        state: 'unknown',
        attributes: { friendly_name: name },
        registry: { area_id: area },
      })),
    ],
    sources: DEMO_ENERGY_SOURCES,
  });
  const stamp = '2026-09-17T19:47:00Z';
  return {
    ...hass,
    states: {
      ...hass.states,
      ...Object.fromEntries(
        Object.entries(demo.states).map(([entity_id, state]) => [
          entity_id,
          {
            entity_id,
            ...state,
            attributes: { ...state.attributes, ...named(state.attributes['friendly_name']) },
            last_changed: stamp,
            last_updated: stamp,
          },
        ]),
      ),
    },
    entities: demo.entities,
    devices: demo.devices,
    areas: demo.areas,
    floors: demo.floors,
  } as unknown as HomeAssistant;
}

/** What a selector finds in the panel, once it is drawn (five seconds at most). */
async function find(
  panel: HTMLElement,
  selector: string,
  text?: string,
): Promise<HTMLElement | null> {
  for (let tries = 0; tries < 100; tries++) {
    const found = [...(panel.shadowRoot?.querySelectorAll<HTMLElement>(selector) ?? [])].find(
      (node) => text === undefined || node.textContent?.trim() === text,
    );
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

/**
 * Unfolds Home's lights to their entities, as a tap on their row does; with `sheet`, the clock instead, and its
 * options in their sheet (the sliders among its buttons). Each waits for what it taps to be drawn.
 */
async function unfold(panel: HTMLElement, sheet: boolean): Promise<void> {
  const part = `.cz-part[data-part="home/${sheet ? 'clock' : 'lights'}"]`;
  (await find(panel, `${part} > .fv-row`))?.click();
  if (sheet) (await find(panel, `${part} .fv-action[aria-label="Options"]`))?.click();
}

/** The sheet "Add a card", opened as a tap on its row opens it; then the way named, as a tap on its chip. */
async function adding(panel: HTMLElement, way?: string): Promise<void> {
  (await find(panel, '.cz-view .fv-row:has(> .fv-row__btn)'))?.click();
  if (way) (await find(panel, '.cz-sheet .fv-chip', way))?.click();
}

/** The moments of 1.21's Customise (#188), each reached as a person reaches it: by taps on what is drawn. */
const MOMENTS: Record<
  'tabs' | 'drag' | 'add' | 'cards' | 'new',
  (panel: HTMLElement) => Promise<void>
> = {
  tabs: async (panel) => {
    (await find(panel, '.cz-place > .fv-row'))?.click();
  },
  // the scenes on their way up the list, as Home Assistant's sorting holds a row: lifted, three rows from the top
  drag: async (panel) => {
    const scenes = await find(panel, '.cz-part[data-part="home/scenes"]');
    const rows = scenes?.parentElement?.querySelectorAll('.cz-part');
    if (!scenes || !rows) return;
    scenes.classList.add('sortable-chosen', 'sortable-ghost');
    rows[2]?.before(scenes);
  },
  // the rooms' scenes found and picked: what a command centre on Home is made of
  add: async (panel) => {
    await adding(panel);
    const field = await find(panel, '.cz-sheet .cz-search input');
    if (!(field instanceof HTMLInputElement)) return;
    field.value = 'scenes';
    field.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    for (const row of panel.shadowRoot?.querySelectorAll<HTMLElement>('.cz-sheet .fv-row') ?? [])
      if (!row.closest('.pn-rows')?.previousElementSibling?.textContent?.includes('Lights'))
        row.click();
  },
  cards: (panel) => adding(panel, 'Fluvy’s cards'),
  new: async (panel) => {
    await adding(panel, 'Fluvy’s cards');
    (await find(panel, '.cz-sheet .fv-row__title', 'Light'))?.click();
  },
};

/** The dashboard panels of the demo home (one of them the home template's, unless `missing`) and the created ones. */
const MOTION_SENSORS = [
  ['binary_sensor.pg_hall_motion', 'Hallway motion', 'motion', 'pg_hall', 'Hallway'],
  ['binary_sensor.pg_porch_occupancy', 'Porch occupancy', 'occupancy', undefined, undefined],
] as const;

/** The house with two sensors that see a person, one of them in a room. */
function withMotionSensors(hass: HomeAssistant): HomeAssistant {
  const states = { ...hass.states };
  const entities = { ...hass.entities };
  const areas = { ...hass.areas };
  const stamp = new Date().toISOString();
  for (const [id, name, cls, area, areaName] of MOTION_SENSORS) {
    states[id] = {
      entity_id: id,
      state: 'off',
      attributes: { friendly_name: name, device_class: cls },
      last_changed: stamp,
      last_updated: stamp,
    } as HassEntity;
    if (area) {
      entities[id] = { entity_id: id, area_id: area } as never;
      areas[area] = { area_id: area, name: areaName } as never;
    }
  }
  return { ...hass, states, entities, areas } as HomeAssistant;
}

function panelsFor(states: readonly PanelState[]): HomeAssistant['panels'] {
  const dashboards = [
    ...DEMO_DASHBOARDS.filter(
      (dashboard) => !(states.includes('missing') && dashboard.url_path === 'fluvy-auto'),
    ),
    ...[...created.values()].map(({ url_path, title, icon }) => ({ url_path, title, icon })),
  ];
  return {
    lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
    ...Object.fromEntries(
      dashboards.map((dashboard) => [
        dashboard.url_path,
        { component_name: 'lovelace', ...dashboard },
      ]),
    ),
    fluvy: { component_name: 'custom', url_path: 'fluvy', title: 'Fluvy', icon: 'fluvy:sun' },
  };
}

/** Whether the demo home's dashboards are listed in the sidebar (the panel's switch changes it here). */
const inSidebar = new Map(DEMO_DASHBOARDS.map((dashboard) => [dashboard.url_path, true]));

/** What Home Assistant answers the panel about the dashboards: their configs and the dashboards collection. */
/** What a template dashboard's configuration says (its options, once saved here). */
const configs = new Map<string, Record<string, unknown>>();

export const PANEL_WS: Record<string, (message: Record<string, unknown>) => unknown> = {
  // the demo home's own energy dashboard, where the page's house is the demo home (the page's own otherwise)
  'energy/get_prefs': () =>
    demoHome
      ? {
          energy_sources: DEMO_ENERGY_SOURCES,
          device_consumption: [{ stat_consumption: 'sensor.washing_machine_energy_today' }],
        }
      : undefined,
  'lovelace/config': (message) => {
    const url = String(message['url_path']);
    const saved = configs.get(url);
    if (saved) return saved;
    if (url === 'fluvy-auto') return { strategy: { type: 'custom:fluvy-home' } };
    const made = created.get(url);
    return made ? { strategy: { type: made.type } } : { views: [] };
  },
  'lovelace/config/save': (message) => {
    configs.set(String(message['url_path']), message['config'] as Record<string, unknown>);
    return undefined;
  },
  'lovelace/dashboards/create': (message) => {
    const made = TEMPLATE_DASHBOARDS.find(
      (dashboard) => dashboard.url_path === message['url_path'],
    );
    if (made) {
      created.set(made.url_path, made);
      // a created dashboard reaches every frontend as a new `panels`: the panel reads the list again
      setTimeout(() => onPanels?.(), 0);
    }
    return undefined;
  },
  'lovelace/dashboards/list': () =>
    [...DEMO_DASHBOARDS, ...created.values()].map((dashboard) => ({
      id: dashboard.url_path.replace(/-/g, '_'),
      url_path: dashboard.url_path,
      title: dashboard.title,
      icon: dashboard.icon,
      show_in_sidebar: inSidebar.get(dashboard.url_path) ?? true,
      require_admin: false,
      mode: 'storage',
    })),
  'lovelace/dashboards/update': (message) => {
    const url = String(message['dashboard_id']).replace(/_/g, '-');
    if (typeof message['show_in_sidebar'] === 'boolean')
      inSidebar.set(url, message['show_in_sidebar']);
    return undefined;
  },
};
