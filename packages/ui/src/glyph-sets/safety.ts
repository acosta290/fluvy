/*
 * The set's water and safety (1.23, #226): what holds and loses water, who is at the door, and what keeps a house
 * safe. No card draws them by itself: Home Assistant's icon picker and a card's `icon: fluvy:leak` draw their outlines,
 * the set's part `safety` (`tools/icons`), fetched the first time one of them is asked for; a chunk that draws one adds
 * the table (`addGlyphs`). Same grid and hand as the set: 24 grid, 1.75 round stroke, ink 3..21 centred on (12, 12).
 * The design lab keeps the same table (`FLUVY.GLYPH_SETS` in `apps/design-lab/fluvy.js`); `glyphs.test.ts` holds them
 * together. Nothing here imports: the icon tools read it as it is.
 */

/** a detector on the ceiling */
const DETECTOR =
  '<path d="M3.5 4h17"/><path d="M5.5 4v1.5a2.5 2.5 0 0 0 2.5 2.5h8a2.5 2.5 0 0 0 2.5-2.5V4"/>';
/** a wave of water, from the left edge to the right */
const wave = (y: number): string =>
  `<path d="M3 ${y}c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/>`;
const dot = (x: number, y: number, r = 0.9): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;

export const SAFETY_GLYPHS = {
  /** a tank: its rim, the water's wave inside it */
  tank: '<path d="M5.5 6.5C5.5 5 8.4 3.75 12 3.75S18.5 5 18.5 6.5v11c0 1.5-2.9 2.75-6.5 2.75S5.5 19 5.5 17.5Z"/><path d="M5.5 6.5c0 1.5 2.9 2.75 6.5 2.75s6.5-1.25 6.5-2.75"/><path d="M5.5 13c1.1.75 2.15.75 3.25 0s2.15-.75 3.25 0 2.15.75 3.25 0 2.15-.75 3.25 0"/>',
  /** a leak: a pipe's joint, a drop falling from it */
  leak: '<path d="M3 6h5.5"/><path d="M3 10.5h5.5"/><path d="M15.5 6H21"/><path d="M15.5 10.5H21"/><rect x="8.5" y="4" width="7" height="8.5" rx="1.25"/><path d="M12 15c-1.15 1.45-1.85 2.45-1.85 3.35a1.85 1.85 0 0 0 3.7 0c0-.9-.7-1.9-1.85-3.35Z"/>',
  /** a flood: a house standing in two waves */
  flood: `<path d="M5.5 10.5 12 4.5l6.5 6"/><path d="M7.5 9v4"/><path d="M16.5 9v4"/>${wave(15.5)}${wave(19.5)}`,
  /** a doorbell: its plate, the bell on its button, its camera */
  doorbell:
    '<rect x="6.5" y="3" width="11" height="18" rx="3"/><path d="M15 15h-6l.75-1V11.5a2.25 2.25 0 0 1 4.5 0V14Z"/><path d="M11.25 17h1.5"/><path d="M12 6.75v.5"/>',
  /** an intercom: its handset beside its panel, the grille and the key */
  intercom: `<path d="M5.5 4h1a1.5 1.5 0 0 1 1.5 1.5V8l-1.5 1v6L8 16v2.5A1.5 1.5 0 0 1 6.5 20h-1A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4Z"/><rect x="11" y="3" width="9.5" height="18" rx="2.5"/>${dot(14, 7.25)}${dot(17.5, 7.25)}${dot(14, 9.75)}${dot(17.5, 9.75)}<path d="M14 15.5h3.5"/>`,
  /** a siren: its dome on its base, its light going out */
  siren:
    '<path d="M7 16.5V12a5 5 0 0 1 10 0v4.5"/><rect x="5" y="16.5" width="14" height="4" rx="1.5"/><path d="M12 3v2"/><path d="m5.6 5.6 1.4 1.4"/><path d="M18.4 5.6 17 7"/><path d="M3 12h1.5"/><path d="M19.5 12H21"/>',
  /** a smoke detector: smoke rising to it */
  smoke: `${DETECTOR}<path d="M8.5 12c-.9 1.05-.9 2.1 0 3.15s.9 2.1 0 3.15"/><path d="M12 11.5c-.9 1.05-.9 2.1 0 3.15s.9 2.1 0 3.15-.9 2.1 0 3.15"/><path d="M15.5 12c-.9 1.05-.9 2.1 0 3.15s.9 2.1 0 3.15"/>`,
  /** a carbon monoxide alarm: the detector over "CO" */
  coAlarm: `${DETECTOR}<path d="M10.6 13.1a3 3 0 1 0 0 4.8"/><circle cx="15.25" cy="15.5" r="3"/>`,
  /** an alarm's panel: its shield over six keys */
  alarmPanel: `<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 5.75 9.5 6.75v1.75c0 1.6 1 2.7 2.5 3.25 1.5-.55 2.5-1.65 2.5-3.25V6.75Z"/>${[8.5, 12, 15.5].map((x) => dot(x, 14.75) + dot(x, 18)).join('')}`,
  /** a keypad: three rows of three keys and the one under them */
  keypad: `${[6.5, 12, 17.5].map((x) => dot(x, 4.5, 1.3) + dot(x, 9.5, 1.3) + dot(x, 14.5, 1.3)).join('')}${dot(12, 19.5, 1.3)}`,
  /** a fingerprint's ridges */
  fingerprint:
    '<path d="M5 9.5a8 8 0 0 1 14 0"/><path d="M5.5 15.5a8 8 0 0 1-.5-3"/><path d="M8 19.5c-1-2-1.5-4-1.5-6.5a5.5 5.5 0 0 1 11 0c0 1.5-.2 3-.6 4.5"/><path d="M9.5 13a2.5 2.5 0 0 1 5 0c0 3.5-.8 6-2.5 8"/><path d="M12 13c0 2.5-.5 4.5-1.5 6.5"/><path d="M16.5 20.25c.25-.5.45-1 .6-1.5"/>',
  /** a safe: its wheel, its handle, on its feet */
  safe: '<rect x="3.5" y="3.5" width="17" height="15.5" rx="2.5"/><circle cx="11" cy="11.25" r="3.5"/><path d="M11 7.75v7"/><path d="M7.5 11.25h7"/><path d="M17 9.5v3.5"/><path d="M7 19v2"/><path d="M17 19v2"/>',
  /** a parcel: its flaps and its tape */
  parcel:
    '<rect x="3.5" y="8.5" width="17" height="12" rx="2"/><path d="M3.5 8.5 5.5 4h13l2 4.5"/><path d="M10 4v7.5h4V4"/>',
} as const;
