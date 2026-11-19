/*
 * The set's home (1.23, #226): the lights people name by their kind, what dresses a window, and the kitchen's cold and
 * its hood. No card draws them by itself: Home Assistant's icon picker and a card's `icon: fluvy:ceiling-light` draw
 * their outlines, the set's part `home` (`tools/icons`), fetched the first time one of them is asked for; a chunk that
 * draws one adds the table (`addGlyphs`). Same grid and hand as the set: 24 grid, 1.75 round stroke, ink 3..21 centred
 * on (12, 12). The design lab keeps the same table (`FLUVY.GLYPH_SETS` in `apps/design-lab/fluvy.js`);
 * `glyphs.test.ts` holds them together. Nothing here imports: the icon tools read it as it is.
 */

const LED = (x: number): string =>
  `<circle cx="${x}" cy="12" r=".9" fill="currentColor" stroke="none"/><path d="M${x} 4.5V7"/><path d="M${x} 17v2.5"/>`;

export const HOME_GLYPHS = {
  /** a ceiling light: its rose and cord, its shade, the light under it */
  ceilingLight:
    '<path d="M9.5 3h5"/><path d="M12 3v4"/><path d="M5 14a7 7 0 0 1 14 0Z"/><path d="M12 17v3"/><path d="M7.5 16.5 6 19"/><path d="M16.5 16.5 18 19"/>',
  /** a desk lamp: its foot, its two arms, its shade turned down */
  deskLamp:
    '<path d="M4.5 21h8"/><path d="M8.5 21 6 14.5l5-5"/><path d="M10 8.5 14 4.5l5 5-4 4a3.5 3.5 0 0 1-5-5Z"/><path d="M18.5 15.5l1.25 1.25"/>',
  /** a strip of lights, each shining both ways */
  ledStrip: `<rect x="3" y="10" width="18" height="4" rx="2"/>${LED(7)}${LED(12)}${LED(17)}`,
  /** curtains drawn open on their rail */
  curtains:
    '<path d="M3 4h18"/><path d="M5 4v16.5h1.5c1.75 0 3-1.5 3.5-4C9.4 13 9 8.5 9.5 4"/><path d="M19 4v16.5h-1.5c-1.75 0-3-1.5-3.5-4 .6-3.5 1-8 .5-12.5"/>',
  /** a roller shutter: its box, its guides and its slats down */
  shutter:
    '<rect x="3" y="3" width="18" height="4.5" rx="1.5"/><path d="M4.5 7.5V21"/><path d="M19.5 7.5V21"/><path d="M4.5 11h15"/><path d="M4.5 14.5h15"/><path d="M4.5 18h15"/>',
  /** an awning out over a window, its stripes and scalloped edge */
  awning:
    '<path d="M3 4h18"/><path d="M3 4l1.5 7.5h15L21 4"/><path d="M9 4l-.5 7.5"/><path d="M15 4l.5 7.5"/><path d="M4.5 11.5a2 2 0 0 0 4 0 1.75 1.75 0 0 0 3.5 0 1.75 1.75 0 0 0 3.5 0 2 2 0 0 0 4 0"/><path d="M7 16v4.5h10V16"/>',
  /** a freezer: its door, its handle, a snowflake */
  freezer:
    '<rect x="5.5" y="3" width="13" height="18" rx="2.5"/><path d="M15.25 5.75v2.5"/><path d="M12 10v7"/><path d="M9 11.75l6 3.5"/><path d="M9 15.25l6-3.5"/>',
  /** a cooker hood: its chimney, its canopy and its lower edge */
  hood: '<path d="M9.5 3v6.5"/><path d="M14.5 3v6.5"/><path d="M9.5 9.5h5l5.5 6H4Z"/><path d="M4 18.5h16"/>',
} as const;
