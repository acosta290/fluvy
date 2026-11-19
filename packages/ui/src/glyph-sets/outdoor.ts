/*
 * The set's outdoors (1.23, #226): the garden, the pool, the post and the bins. No card draws them by itself: Home
 * Assistant's icon picker and a card's `icon: fluvy:sprinkler` draw their outlines, the set's part `outdoor`
 * (`tools/icons`), fetched the first time one of them is asked for; a chunk that draws one adds the table
 * (`addGlyphs`). Same grid and hand as the set: 24 grid, 1.75 round stroke, ink 3..21 centred on (12, 12). The design
 * lab keeps the same table (`FLUVY.GLYPH_SETS` in `apps/design-lab/fluvy.js`); `glyphs.test.ts` holds them together.
 * Nothing here imports: the icon tools read it as it is.
 */

const wave = (y: number): string =>
  `<path d="M3 ${y}c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/>`;
const dot = (x: number, y: number): string =>
  `<circle cx="${x}" cy="${y}" r="1" fill="currentColor" stroke="none"/>`;
/** a picket of the fence, its point at `x` */
const picket = (x: number): string => `<path d="M${x - 1.5} 20.5V6.75L${x} 4.5l1.5 2.25V20.5"/>`;

export const OUTDOOR_GLYPHS = {
  /** a mailbox on its post, its flag up */
  mailbox:
    '<path d="M3.5 15V9.5a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4V15Z"/><path d="M7.5 5.5a4 4 0 0 1 4 4V15"/><path d="M15.5 10V7.5h2.5"/><path d="M12 15v6"/>',
  /** a fence: three pickets on two rails */
  fence: `${picket(6)}${picket(12)}${picket(18)}<path d="M7.5 9.5h3"/><path d="M13.5 9.5h3"/><path d="M7.5 15.5h3"/><path d="M13.5 15.5h3"/>`,
  /** a pool: its ladder over the water */
  pool: `<path d="M7 14V6a2 2 0 0 1 4 0"/><path d="M14 14V6a2 2 0 0 1 4 0"/><path d="M7 8.5h7"/><path d="M7 11.75h7"/>${wave(16.5)}${wave(20)}`,
  /** a sprinkler: its head in the lawn, three jets */
  sprinkler: `<path d="M3.5 20.5h17"/><path d="M10.5 20.5V16h3v4.5"/><path d="M10 13.5 6.5 10"/><path d="M12 12.5V8"/><path d="M14 13.5 17.5 10"/>${dot(4.75, 8.25)}${dot(12, 5)}${dot(19.25, 8.25)}`,
  /** a lawn mower: its deck on its wheels, its handle */
  mower:
    '<path d="M15 11.5 18.5 3.5"/><path d="M17 3.5h3.5"/><path d="M3 15.5v-1a4 4 0 0 1 4-4h6.5a4 4 0 0 1 4 4v1Z"/><circle cx="6.5" cy="18.75" r="1.75"/><circle cx="14" cy="18.75" r="1.75"/>',
  /** a plant in its pot: two leaves */
  plant:
    '<path d="M7 14.5h10l-1.25 6.5h-7.5Z"/><path d="M12 14.5V9.5"/><path d="M12 11.5C9 11.5 7 9.5 6.5 6.5c3 0 5 2 5.5 5Z"/><path d="M12 9.5c0-3 2-5.5 5.5-6-.5 3.5-2.5 5.5-5.5 6Z"/>',
  /** a tree: its crown, its trunk and two branches */
  tree: '<path d="M8.5 15.5A4.5 4.5 0 0 1 6.6 7a5.5 5.5 0 0 1 10.8 0 4.5 4.5 0 0 1-1.9 8.5Z"/><path d="M12 11v10"/><path d="M12 14l2.5-2.5"/><path d="M12 16.5 9.5 14"/>',
  /** a barbecue: its kettle on three legs, smoke over the grill */
  bbq: '<path d="M3.5 10.5h17"/><path d="M4.5 10.5a7.5 7.5 0 0 0 15 0"/><path d="M8 17 6.5 21"/><path d="M16 17l1.5 4"/><path d="M9 3.5c-.8.9-.8 1.6 0 2.5"/><path d="M12 3c-.8.9-.8 1.6 0 2.5"/><path d="M15 3.5c-.8.9-.8 1.6 0 2.5"/>',
  /** an outdoor light: a lantern on its wall bracket */
  outdoorLight:
    '<path d="M5.5 4v9"/><path d="M5.5 7h4"/><path d="M9.5 7.5 14 4.5l4.5 3Z"/><path d="M10 7.5h8l-1 8.5h-6Z"/><path d="M14 10.5v2.5"/><path d="M12 19h4"/>',
  /** recycling: three arrows chasing round */
  recycle:
    '<path d="M8.5 6.6 10.3 3.75a2 2 0 0 1 3.4 0l2.3 3.85"/><path d="m16.6 5.4-.6 2.2-2.2-.6"/><path d="M18.4 11.1l1.95 3.4a2 2 0 0 1-1.7 3H15"/><path d="m16.6 15.5-1.6 2 1.6 1.6"/><path d="M9 17.5H5.35a2 2 0 0 1-1.7-3l1.9-3.3"/><path d="M3.9 12.6 5.55 11.2l1.55 1.75"/>',
} as const;
