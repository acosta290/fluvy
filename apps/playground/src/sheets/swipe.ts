import { FluvyBatteriesCard } from '../../../../packages/cards/src/batteries/batteries-card.js';
import { FluvyCameraCard } from '../../../../packages/cards/src/camera/camera-card.js';
import { FluvyChipsCard } from '../../../../packages/cards/src/chips/chips-card.js';
import { FluvyGridCard } from '../../../../packages/cards/src/grid/grid-card.js';
import { FluvyLightCard } from '../../../../packages/cards/src/light/light-card.js';
import { FluvyRoomCard } from '../../../../packages/cards/src/room/room-card.js';
import { FluvySwipeCard } from '../../../../packages/cards/src/swipe/swipe-card.js';
import '../../../../packages/cards/src/swipe/english.js';
import { FluvyTileCard } from '../../../../packages/cards/src/tile/tile-card.js';
import { FluvyTilesCard } from '../../../../packages/cards/src/tiles/tiles-card.js';
import type { StateSeed } from '../hass.js';
import { defineCardWrapper } from '../hui-card.js';
import type { SheetSpec } from '../scenes.js';
import { sheet as balance } from './balance.js';
import { sheet as cameras } from './cameras.js';
import { sheet as rooms } from './rooms.js';
import { sheet as storage } from './storage.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the Expander's sheet does,
// and the cards it holds that come in chunks of their own; Home Assistant's wrapper is the playground's stand-in
const define = (tag: string, element: CustomElementConstructor): void => {
  if (!customElements.get(tag)) customElements.define(tag, element);
};
define('fluvy-swipe-card', FluvySwipeCard);
define('fluvy-room-card', FluvyRoomCard);
define('fluvy-camera-card', FluvyCameraCard);
define('fluvy-grid-card', FluvyGridCard);
define('fluvy-batteries-card', FluvyBatteriesCard);
define('fluvy-light-card', FluvyLightCard);
define('fluvy-chips-card', FluvyChipsCard);
define('fluvy-tiles-card', FluvyTilesCard);
define('fluvy-tile-card', FluvyTileCard);
defineCardWrapper();

const SWIPE = 'custom:fluvy-swipe-card';
const NOW = '2026-09-17T21:47:12';

/** A swipe card of `cards`, nothing kept between two looks at the sheet. */
const swipe = (cards: readonly Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
  type: SWIPE,
  remember: 'off',
  cards,
  ...extra,
});

/** The rooms of the flat, from the rooms sheet: the living room in its photo, the kitchen, the bedroom. */
const ROOMS = [
  { type: 'custom:fluvy-room-card', area: 'rm_living', path: '/fluvy-auto/room-rm_living' },
  { type: 'custom:fluvy-room-card', area: 'rm_kitchen' },
  { type: 'custom:fluvy-room-card', area: 'rm_bedroom' },
];

/** The four cameras round the house, from the cameras sheet. */
const CAMERAS = ['driveway', 'garden', 'terrace', 'garage'].map((name) => ({
  type: 'custom:fluvy-camera-card',
  entity: `camera.cm_${name}`,
}));

/** The energy of the #19 house, from the balance and storage sheets: the grid, the batteries, the net on its gauge. */
const GRID = {
  type: 'custom:fluvy-grid-card',
  phases: ['sensor.bl_l1', 'sensor.bl_l2', 'sensor.bl_l3'],
  voltages: ['sensor.bl_v1', 'sensor.bl_v2', 'sensor.bl_v3'],
  price: 'sensor.bl_price',
  _now: NOW,
};
const BATTERIES = {
  type: 'custom:fluvy-batteries-card',
  batteries: [
    { power: 'sensor.st_garage', level: 'sensor.st_garage_level', capacity: 10, name: 'Garage' },
    {
      power: 'sensor.st_basement',
      level: 'sensor.st_basement_level',
      capacity: 10,
      name: 'Basement',
    },
  ],
  reserve: 20,
};
const NET = {
  type: 'custom:fluvy-gauge-card',
  entity: 'sensor.bl_grid_net',
  variant: 'signed',
  icon: 'tower',
  label: 'Net',
  max: 5,
};
const ENERGY = [GRID, BATTERIES, NET];

type Attributes = Record<string, unknown>;
const lamp = (name: string, level?: number): Attributes => ({
  friendly_name: name,
  supported_color_modes: ['brightness'],
  ...(level === undefined
    ? {}
    : { color_mode: 'brightness', brightness: Math.round((level / 100) * 255) }),
});

/** The lamps of the evening, and a door that keeps a page out of the row while it is shut. */
const STATES: readonly StateSeed[] = [
  ['light.sw_sofa', 'on', lamp('Sofa lamp', 62)],
  ['light.sw_desk', 'off', lamp('Desk lamp')],
  ['light.sw_hall', 'on', lamp('Hall', 30)],
  ['light.sw_porch', 'off', lamp('Porch')],
  ['switch.sw_kettle', 'off', { friendly_name: 'Kettle' }],
  ['switch.sw_fan', 'on', { friendly_name: 'Bathroom fan' }],
  ['binary_sensor.sw_shed_door', 'off', { friendly_name: 'Shed door', device_class: 'door' }],
];

/** The house's lamps as pages: the precision ruler, each lamp its own. */
const LAMPS = ['light.sw_sofa', 'light.sw_desk', 'light.sw_hall'].map((entity) => ({
  type: 'custom:fluvy-light-card',
  entity,
}));
/** The views as a row of chips wider than a phone: the row scrolls under the finger, the page stays. */
const CHIPS = {
  type: 'custom:fluvy-chips-card',
  chips: ['All', 'Living', 'Kitchen', 'Bedroom', 'Bathroom', 'Hall', 'Garage', 'Garden'].map(
    (label) => ({ label, path: `/fluvy-home/${label.toLowerCase()}` }),
  ),
};
/** A set of compact tiles: a page as small as a card goes. */
const tiles = (entities: readonly string[]) => ({
  type: 'custom:fluvy-tiles-card',
  size: 'compact',
  columns: 2,
  entities,
});
const TILES = [
  tiles(['light.sw_sofa', 'light.sw_desk']),
  tiles(['light.sw_hall', 'light.sw_porch']),
  tiles(['switch.sw_kettle', 'switch.sw_fan']),
];
/** Each of the house's switches as a compact tile of its own: a page that holds its 76 in half a section. */
const ONE_EACH = [
  'light.sw_sofa',
  'light.sw_desk',
  'light.sw_hall',
  'light.sw_porch',
  'switch.sw_kettle',
  'switch.sw_fan',
].map((entity) => ({ type: 'custom:fluvy-tile-card', entity, size: 'compact' }));

/** A view's background behind see-through cards: dusk over the garden. */
const DUSK = 'linear-gradient(160deg, #1f2f4f 0%, #6f5a86 52%, #e39a72 100%)';

/**
 * The Swipe card (#206): any cards, one a page, turned by a finger or a trackpad — on one surface, the cards drawing
 * none of their own, or each on its own with the marks on the page; the flat's rooms, its cameras going round, the
 * #19 house's energy; side by side on a desktop; opening on another page; the counter where the marks would not fit;
 * no marks; a ruler and a row of chips that keep their drags; a page that is no page while its card hides; no cards
 * yet; see-through over a view's background; in a section's halves; tiles on its surface.
 */
export const sheet: SheetSpec = {
  states: [...STATES, ...rooms.states, ...cameras.states, ...balance.states, ...storage.states],
  // the grid's day as the balance sheet's Energy dashboard has it: what its totals are read from
  ...(balance.history ? { history: balance.history } : {}),
  ...(balance.ws ? { ws: balance.ws } : {}),
  registry: {
    entities: { ...rooms.registry?.entities, ...cameras.registry?.entities },
    devices: { ...rooms.registry?.devices, ...cameras.registry?.devices },
    areas: { ...rooms.registry?.areas, ...cameras.registry?.areas },
    ...(rooms.registry?.floors ? { floors: rooms.registry.floors } : {}),
  },
  frames: [
    // the reporter's case: a room's cards a swipe apart, on one surface, the marks under them
    { title: 'Rooms', cards: [swipe(ROOMS)] },
    // each room on its own surface, the marks on the page
    { title: 'Rooms · plain', cards: [swipe(ROOMS, { style: 'plain' })] },
    // the cameras round the house, going round from the garage to the driveway
    { title: 'Cameras · round', cards: [swipe(CAMERAS, { loop: true })] },
    { title: 'Cameras · plain', cards: [swipe(CAMERAS, { style: 'plain', loop: true })] },
    // a wall's cameras, a page every four seconds, held while a finger, the pointer or the focus is on them
    { title: 'Cameras · by themselves', cards: [swipe(CAMERAS, { loop: true, autoplay: 4 })] },
    // the energy of the house, a card a page
    { title: 'Energy', cards: [swipe(ENERGY)] },
    // across a desktop: two cameras and two energy cards side by side, a page further each time
    {
      title: 'Cameras · two side by side · 1400',
      width: 1400,
      cards: [swipe(CAMERAS, { columns: 2, loop: true })],
    },
    {
      title: 'Energy · three side by side · 1400',
      width: 1400,
      cards: [swipe([...ENERGY, GRID], { style: 'plain', columns: 3 })],
    },
    // it opens on its second page, in its own colour
    { title: 'Starts on the garden', cards: [swipe(CAMERAS, { start: 2, color: 'teal' })] },
    // more pages than half a section holds marks for: the counter between its two turns, each page a tile that keeps
    // its height there; on the surface the tile keeps the surface's 20 round it
    {
      title: 'Half pairs · the counter',
      heights: [152, 172],
      cards: [
        { ...swipe(ONE_EACH, { style: 'plain' }), cols: 6 },
        { ...swipe(ONE_EACH, { style: 'plain', loop: true, start: 3 }), cols: 6 },
      ],
    },
    {
      title: 'Half pairs · the counter on one card',
      cards: [
        { ...swipe(ONE_EACH), cols: 6 },
        { ...swipe(ONE_EACH.slice(0, 3)), cols: 6 },
      ],
    },
    // no marks: the finger, the trackpad and the keys turn it
    { title: 'No marks', cards: [swipe(LAMPS.slice(0, 2), { show_indicators: false })] },
    // a drag on a ruler sets the lamp, never turns the page; a row of chips scrolls, the page stays
    { title: 'Lamps · the ruler keeps its drag', cards: [swipe(LAMPS)] },
    {
      title: 'Chips · the row keeps its drag',
      cards: [swipe([CHIPS, ...TILES], { style: 'plain' })],
    },
    // the porch's tile only while the shed's door is open: shut, it is no page and has no mark
    {
      title: 'A page that is no page',
      cards: [
        swipe(
          [
            ...TILES.slice(0, 2),
            {
              ...tiles(['light.sw_porch']),
              visibility: [
                { condition: 'state', entity: 'binary_sensor.sw_shed_door', state: 'on' },
              ],
            },
            TILES[2] ?? {},
          ],
          { style: 'plain' },
        ),
      ],
    },
    { title: 'No cards yet', cards: [swipe([]), swipe([], { style: 'plain' })] },
    // see-through over a view's background: the surface blurs what shows through, what it holds draws no box
    {
      title: 'See-through',
      backdrop: DUSK,
      cards: [swipe(ROOMS, { card_opacity: 60 })],
    },
    // as the person left it, in this tab: what the other frames switch off
    { title: 'Remembers', cards: [swipe(TILES, { style: 'plain', remember: 'session' })] },
    // tiles on its surface: they keep a surface of their own, the card's 20 round them, as it declares
    { title: 'Tiles · on its surface', cards: [swipe(TILES)] },
  ],
};
