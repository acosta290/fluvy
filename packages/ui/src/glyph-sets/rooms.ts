/*
 * The set's rooms (1.23, #226): each drawn by what it is for — the kitchen's pot, the bedroom's bed, the bathroom's
 * tub, the living room's sofa — so a list of rooms reads at a glance, and the area icons people pick in Home Assistant
 * for them (`ROOM_ICONS`). A card of rooms adds the table as its chunk lands (`addGlyphs`) and draws an area's room by
 * its icon; Home Assistant's icon picker and a card's `icon: fluvy:kitchen` draw their outlines, the set's part
 * `rooms` (`tools/icons`). Same grid and hand as the set: 24 grid, 1.75 round stroke, ink 3..21 centred on (12, 12).
 * The design lab keeps the same table (`FLUVY.GLYPH_SETS` in `apps/design-lab/fluvy.js`); `glyphs.test.ts` holds them
 * together. Nothing here imports: the icon tools read it as it is.
 */

const dot = (x: number, y: number, r: number): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;

export const ROOM_GLYPHS = {
  /** the kitchen: a pot on the boil, its lid and handles */
  kitchen:
    '<path d="M4.5 11h15v4.5a5 5 0 0 1-5 5h-5a5 5 0 0 1-5-5Z"/><path d="M4.5 13H3"/><path d="M19.5 13H21"/><path d="M4.5 8.5h15"/><path d="M12 8.5V7"/><path d="M9 3c-.8.9-.8 1.6 0 2.5"/><path d="M15 3c-.8.9-.8 1.6 0 2.5"/>',
  /** a bedroom: a bed, its headboard and its pillow */
  bedroom:
    '<path d="M3.5 4.5v16"/><path d="M20.5 12v8.5"/><path d="M3.5 12h17"/><path d="M3.5 16.5h17"/><path d="M6 12v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/>',
  /** a bathroom: a bath on its feet, the shower over it */
  bathroom:
    '<path d="M3 11.5h18"/><path d="M4 11.5V14a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5v-2.5"/><path d="M7 19l-1 2"/><path d="M17 19l1 2"/><path d="M6.5 11.5V6a2.5 2.5 0 0 1 4.75-1.1"/><path d="M10 6.5l3-1.5"/>',
  /** a child's room: a teddy bear */
  kidsRoom: `<circle cx="12" cy="13.25" r="6.75"/><path d="M6.48 9.37A2.5 2.5 0 1 1 8.54 7.46"/><path d="M15.46 7.46A2.5 2.5 0 1 1 17.52 9.37"/><ellipse cx="12" cy="16" rx="2.75" ry="2"/>${dot(9.5, 12, 0.95)}${dot(14.5, 12, 0.95)}${dot(12, 15.4, 0.8)}`,
  /** an office: a desk with its drawer, the screen on it */
  office:
    '<path d="M3 13.5h18"/><path d="M5 13.5V21"/><path d="M19 13.5V21"/><path d="M14.5 13.5V17h4.5"/><rect x="5.5" y="3" width="10" height="7" rx="1.5"/><path d="M10.5 10v3.5"/>',
  /** a dining room: a fork and a knife */
  dining:
    '<path d="M6.5 3v4.5a1.75 1.75 0 0 0 3.5 0V3"/><path d="M8.25 9.25V21"/><path d="M17.5 21V3c-1.9 1.3-3 4-3 8h3"/>',
  /** a laundry: the wash tub of a garment's label */
  laundry:
    '<path d="M3 5l2.25 13a2 2 0 0 0 2 1.5h9.5a2 2 0 0 0 2-1.5L21 5"/><path d="M4 9.5c1.3.9 2.7.9 4 0s2.7-.9 4 0 2.7.9 4 0 2.7-.9 4 0"/>',
  /** a garden: a tulip in the ground */
  garden:
    '<path d="M8.5 4v3.5a3.5 3.5 0 0 0 7 0V4l-1.75 1.5L12 3.75 10.25 5.5Z"/><path d="M12 11v9.5"/><path d="M12 18c-3 0-5-1.75-5.5-4.5 3 0 5 1.75 5.5 4.5Z"/><path d="M12 15.5c3 0 5-1.75 5.5-4.5-3 0-5 1.75-5.5 4.5Z"/><path d="M7 20.5h10"/>',
  /** a living room: a sofa */
  livingRoom:
    '<path d="M5.5 10V7a2.5 2.5 0 0 1 2.5-2.5h8A2.5 2.5 0 0 1 18.5 7v3"/><path d="M3 12.5a2 2 0 0 1 4 0V14h10v-1.5a2 2 0 0 1 4 0V18H3Z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  /** a hallway: a coat's hanger */
  hallway:
    '<path d="M10 7.25a2 2 0 1 1 2 2v1.5"/><path d="M12 10.75 3.6 16.85a1 1 0 0 0 .6 1.9h15.6a1 1 0 0 0 .6-1.9Z"/>',
  /** the stairs: four steps up */
  stairs: '<path d="M3 20h3.5v-4H10v-4h3.5V8H17V4h4"/>',
  /** a toilet: its cistern, its bowl on its foot */
  toilet:
    '<rect x="4" y="3" width="5.5" height="8" rx="1.5"/><path d="M4 11h16v.5a6.5 6.5 0 0 1-6.5 6.5H11"/><path d="M8 18l-.5 3h5l-.5-3"/><path d="M4 11v1.5a5.5 5.5 0 0 0 4 5.3"/>',
} as const;

export type RoomGlyphName = keyof typeof ROOM_GLYPHS;

/** The set's glyph for each kind of room, by the Material icons people pick for it (their names without `mdi:`). */
const ROOMS: Readonly<Record<string, string>> = {
  kitchen:
    'stove chef-hat pot pot-outline pot-steam pot-steam-outline pot-mix fridge fridge-outline countertop countertop-outline microwave kettle toaster-oven',
  dining:
    'silverware-fork-knife silverware silverware-variant table-chair table-furniture food food-fork-drink',
  bedroom:
    'bed bed-outline bed-king bed-king-outline bed-queen bed-queen-outline bed-double bed-double-outline bed-single bed-single-outline bed-empty sleep power-sleep',
  bathroom: 'shower shower-head bathtub bathtub-outline paper-roll paper-roll-outline',
  toilet: 'toilet human-male-female',
  'kids-room':
    'teddy-bear human-child human-male-child human-female-girl baby-face baby-face-outline baby-carriage toy-brick toy-brick-outline',
  office:
    'desk laptop monitor desktop-classic briefcase briefcase-outline chair-rolling book-open-variant',
  laundry: 'washing-machine tumble-dryer basket basket-outline iron iron-outline',
  garden:
    'flower flower-outline flower-tulip flower-tulip-outline grass sprout sprout-outline greenhouse shovel',
  tree: 'tree tree-outline pine-tree palm-tree forest nature',
  'living-room':
    'sofa sofa-outline sofa-single sofa-single-outline fireplace television television-classic',
  hallway: 'coat-rack hanger',
  stairs: 'stairs stairs-up stairs-down stairs-box',
  garage: 'garage garage-variant garage-open garage-open-variant',
  door: 'door door-closed door-open door-sliding',
  pool: 'pool hot-tub',
  server: 'server server-network router-network nas',
};

/**
 * The set's own icon for an area's (`mdi:bed` → `fluvy:bedroom`): a room drawn by what it is for, where its icon says
 * it; undefined for any other icon, which keeps its own.
 */
export const ROOM_ICONS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ROOMS).flatMap(([glyph, names]) =>
    names.split(' ').map((name) => [`mdi:${name}`, `fluvy:${glyph}`] as const),
  ),
);
