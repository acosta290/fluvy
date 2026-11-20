/*
 * The set's energy (1.23, #226): what makes, stores, carries and counts it. No card draws them by itself: Home
 * Assistant's icon picker and a card's `icon: fluvy:solar-panel` draw their outlines, the set's part `energy`
 * (`tools/icons`), fetched the first time one of them is asked for; a chunk that draws one adds the table
 * (`addGlyphs`). Same grid and hand as the set: 24 grid, 1.75 round stroke, ink 3..21 centred on (12, 12). The design
 * lab keeps the same table (`FLUVY.GLYPH_SETS` in `apps/design-lab/fluvy.js`); `glyphs.test.ts` holds them together.
 * Nothing here imports: the icon tools read it as it is.
 */

/** a meter's case and its counter's window */
const METER =
  '<rect x="4" y="3" width="16" height="18" rx="3"/><rect x="7" y="6" width="10" height="3.5" rx="1"/>';

export const ENERGY_GLYPHS = {
  /** a battery that asks for attention: an exclamation mark through its body, the body cut clear of it */
  batteryAlert:
    '<path d="M8.75 8H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h3.75"/><path d="M13.25 8H17a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3.75"/><path d="M21 11v2"/><path d="M11 6.5v5.75"/><circle cx="11" cy="16" r=".95" fill="currentColor" stroke="none"/>',
  /** a solar panel on its stand: six cells, wider at the foot */
  solarPanel:
    '<path d="M6 3.5h12l2.5 10h-17Z"/><path d="M4.75 8.5h14.5"/><path d="M10 3.5 9.2 13.5"/><path d="M14 3.5l.8 10"/><path d="M12 13.5v7"/><path d="M8 20.5h8"/>',
  /** a home battery: a house with a battery standing in it */
  batteryHome:
    '<path d="M4 10.5 12 4l8 6.5v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><rect x="9.25" y="11.5" width="5.5" height="7" rx="1.25"/><path d="M11 9.75h2"/><rect x="10.75" y="15" width="2.5" height="2" rx=".5" fill="currentColor" stroke="none"/>',
  /** a car's charger: its post with a bolt, the cable to its plug */
  evPlug:
    '<rect x="3" y="3" width="10" height="18" rx="2.5"/><path d="M8.75 6.5 6.5 11h3L7.25 15.5"/><path d="M13 16.5h1.25a1.5 1.5 0 0 0 1.5-1.5V12a1.75 1.75 0 0 1 3.5 0v-1.5"/><path d="M17.5 10.5V7.5h3.5v3Z"/><path d="M18.25 7.5V5.5"/><path d="M20.25 7.5V5.5"/>',
  /** an electricity meter: its counter over a bolt */
  electricMeter: `${METER}<path d="M12.75 12 10.5 15.75h3l-2.25 3.75"/>`,
  /** a gas meter: its counter over a flame */
  gasMeter: `${METER}<path d="M12.2 12c1.4 1 2.55 3.05 2.55 5.2a2.75 2.75 0 0 1-5.5 0c0-.95.25-1.8.65-2.55.25.55.55.85 1 .95.05-1.45.4-2.7 1.3-3.6Z"/>`,
  /** a water meter: its counter over a drop */
  waterMeter: `${METER}<path d="M12 12c1.6 1.95 2.75 3.3 2.75 4.75a2.75 2.75 0 0 1-5.5 0c0-1.45 1.15-2.8 2.75-4.75Z"/>`,
  /** a wall socket: its plate, its recess and two holes */
  socket:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="9.6" cy="12" r="1.05" fill="currentColor" stroke="none"/><circle cx="14.4" cy="12" r="1.05" fill="currentColor" stroke="none"/>',
} as const;
