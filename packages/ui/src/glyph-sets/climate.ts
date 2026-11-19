/*
 * The set's climate and air (1.23, #226): what heats, cools and cleans a room, and what its air is read by. No card
 * draws them by itself: Home Assistant's icon picker and a card's `icon: fluvy:radiator` draw their outlines, the set's
 * part `climate` (`tools/icons`), fetched the first time one of them is asked for; a chunk that draws one adds the
 * table (`addGlyphs`). Same grid and hand as the set: 24 grid, 1.75 round stroke, ink 3..21 centred on (12, 12); the
 * thermometer and the drop of a reading going up or down are the set's own `thermo` and `drop`, made room for the
 * arrow. The design lab keeps the same table (`FLUVY.GLYPH_SETS` in `apps/design-lab/fluvy.js`); `glyphs.test.ts`
 * holds them together. Nothing here imports: the icon tools read it as it is.
 */

/** an appliance's tall case and its grille */
const CASE = '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 6.5h7"/>';
const THERMO = '<path d="M7 4.5a2 2 0 1 1 4 0v9.3a4 4 0 1 1-4 0Z"/>';
const DROP = '<path d="M9 5.5c2.6 3.4 5 6.1 5 8.9a5 5 0 0 1-10 0c0-2.8 2.4-5.5 5-8.9Z"/>';
const up = (x: number): string =>
  `<path d="M${x} 13V4.5"/><path d="m${x - 2.5} 7 2.5-2.5L${x + 2.5} 7"/>`;
const down = (x: number): string =>
  `<path d="M${x} 4.5V13"/><path d="m${x - 2.5} 10.5 2.5 2.5 2.5-2.5"/>`;
const dot = (x: number, y: number, r = 0.9): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;

export const CLIMATE_GLYPHS = {
  /** a panel radiator on its feet */
  radiator:
    '<rect x="3.5" y="4" width="17" height="13" rx="2"/><path d="M7.75 4v13"/><path d="M12 4v13"/><path d="M16.25 4v13"/><path d="M6 17v3"/><path d="M18 17v3"/>',
  /** a wall boiler: its flame, its three pipes */
  boiler:
    '<rect x="5" y="3" width="14" height="13.5" rx="2.5"/><path d="M12.1 6c1.3.9 2.4 2.9 2.4 5a2.5 2.5 0 0 1-5 0c0-.9.2-1.7.6-2.4.2.5.5.8.9.9 0-1.4.3-2.6 1.1-3.5Z"/><path d="M8.5 16.5V21"/><path d="M12 16.5V21"/><path d="M15.5 16.5V21"/>',
  /** an air conditioner's wall unit, its louvre and the air it sends */
  aircon:
    '<rect x="3" y="4" width="18" height="9" rx="2.5"/><path d="M6.5 10h11"/><path d="M8 16l-1 3.5"/><path d="M12 16v4"/><path d="M16 16l1 3.5"/>',
  /** a dehumidifier: its case and the water it takes */
  dehumidifier: `${CASE}<path d="M12 10.5c1.6 2 2.75 3.4 2.75 4.75a2.75 2.75 0 0 1-5.5 0c0-1.35 1.15-2.75 2.75-4.75Z"/>`,
  /** an air purifier: its case, a second grille and its filter's round */
  purifier: `${CASE}<path d="M8.5 9h7"/><circle cx="12" cy="15" r="3"/>${dot(12, 15)}`,
  /** a ceiling fan: its rod and hub, two blades, its light */
  ceilingFan:
    '<path d="M12 5v4"/><circle cx="12" cy="11.5" r="2.5"/><path d="M9.6 10.8 4.4 9.7a.8.8 0 0 0-.4 1.5l5.5 2"/><path d="M14.4 10.8l5.2-1.1a.8.8 0 0 1 .4 1.5l-5.5 2"/><path d="M10.25 16.5a1.75 1.75 0 0 0 3.5 0Z"/>',
  /** carbon dioxide, as it is written */
  co2: '<path d="M8.1 6.85a3.25 3.25 0 1 0 0 5.3"/><circle cx="13.5" cy="9.5" r="3.25"/><path d="M17.75 15.4a1.6 1.6 0 1 1 2.7 1.2L17.75 19.5h3.25"/>',
  /** the air we breathe: two lungs */
  airQuality:
    '<path d="M12 3v7"/><path d="M12 10 9.75 12"/><path d="M12 10l2.25 2"/><path d="M9.5 7.5C7 6.5 4 9 4 14.5 4 18 5 20.5 7 20.5s2.5-1.5 2.5-4Z"/><path d="M14.5 7.5c2.5-1 5.5 1.5 5.5 7 0 3.5-1 6-3 6s-2.5-1.5-2.5-4Z"/>',
  /** particles in the air, large and small */
  particles: `<circle cx="7.5" cy="7.5" r="2.25"/><circle cx="16" cy="6" r="1.5"/><circle cx="15.5" cy="15.5" r="2.5"/><circle cx="7" cy="16.5" r="1.5"/>${dot(11.75, 11.25, 1.1)}${dot(19.75, 10.75)}${dot(4, 12)}${dot(11.5, 19.75)}${dot(11.25, 4)}`,
  /** a molecule: what a VOC sensor reads */
  voc: '<circle cx="12" cy="13" r="2.5"/><circle cx="5.75" cy="7" r="1.75"/><circle cx="18.25" cy="7" r="1.75"/><circle cx="12" cy="19.75" r="1.25"/><path d="M10.2 11.2 7.1 8.25"/><path d="M13.8 11.2l3.1-2.95"/><path d="M12 15.5v3"/>',
  /** a pressure gauge: its dial, three marks, the needle on its hub */
  pressure: `<path d="M5.6 17.9a8.5 8.5 0 1 1 12.8 0"/><path d="M12 6v1.5"/><path d="M6 12h1.5"/><path d="M18 12h-1.5"/><path d="M12 13l3-3.5"/>${dot(12, 13, 1.4)}`,
  /** ultraviolet, as it is written */
  uv: '<path d="M4 7.5V13a3.5 3.5 0 0 0 7 0V7.5"/><path d="M13.25 7.5l3.5 9 3.5-9"/>',
  /** a rain gauge: its funnel, its tube marked, the rain over it */
  rainGauge:
    '<path d="M8.5 8v10.5A2.5 2.5 0 0 0 11 21h2a2.5 2.5 0 0 0 2.5-2.5V8"/><path d="M6.5 8h11"/><path d="M8.5 12h2.5"/><path d="M8.5 15h2"/><path d="M8.5 18h2.5"/><path d="M10 3.5l-.75 2"/><path d="M14.5 3.5l-.75 2"/>',
  /** a temperature high: the thermometer full, an arrow up */
  thermoHigh: `${THERMO}<path d="M9 6.5v9"/>${up(17.5)}`,
  /** a temperature low: the thermometer low, an arrow down */
  thermoLow: `${THERMO}<path d="M9 13.5v2"/>${down(17.5)}`,
  /** humidity high: the drop, an arrow up */
  humidHigh: `${DROP}${up(18.5)}`,
  /** humidity low: the drop, an arrow down */
  humidLow: `${DROP}${down(18.5)}`,
} as const;
