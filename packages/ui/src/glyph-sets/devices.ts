/*
 * The set's devices (1.23, #226): what a house is connected by and what its people carry, watch and play on. No card
 * draws them by itself: Home Assistant's icon picker and a card's `icon: fluvy:router` draw their outlines, the set's
 * part `devices` (`tools/icons`), fetched the first time one of them is asked for; a chunk that draws one adds the
 * table (`addGlyphs`). Same grid and hand as the set: 24 grid, 1.75 round stroke, ink 3..21 centred on (12, 12). The
 * design lab keeps the same table (`FLUVY.GLYPH_SETS` in `apps/design-lab/fluvy.js`); `glyphs.test.ts` holds them
 * together. Nothing here imports: the icon tools read it as it is.
 */

const LED = (x: number, y: number): string =>
  `<circle cx="${x}" cy="${y}" r=".9" fill="currentColor" stroke="none"/>`;

export const DEVICE_GLYPHS = {
  /** a router: its box with two lights and a bar, its two antennas, a wave between them */
  router: `<rect x="3" y="12.5" width="18" height="7.5" rx="2.5"/><path d="M7 12.5 5.75 4.5"/><path d="M17 12.5l1.25-8"/><path d="M9.5 8.25a3.5 3.5 0 0 1 5 0"/>${LED(7, 16.25)}${LED(10.25, 16.25)}<path d="M13.75 16.25h3.25"/>`,
  /** a network socket: its opening with the clip's notch, three contacts */
  ethernet:
    '<path d="M4 4h16v11a2 2 0 0 1-2 2h-3v3H9v-3H6a2 2 0 0 1-2-2Z"/><path d="M8.5 4v3.5"/><path d="M12 4v3.5"/><path d="M15.5 4v3.5"/>',
  /** Bluetooth's rune */
  bluetooth: '<path d="M7.5 8.25l9.5 7.5-5 4.25V4l5 4.25-9.5 7.5"/>',
  /** a phone, its bar at the foot */
  phone: '<rect x="6.5" y="3" width="11" height="18" rx="2.5"/><path d="M10.75 18h2.5"/>',
  /** a tablet: the phone's shape, wider */
  tablet: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M10.5 18h3"/>',
  /** a laptop open: its screen over its base */
  laptop:
    '<path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V15"/><path d="M3 15h18v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z"/>',
  /** a desktop computer: a screen with its chin on its foot (the television has none) */
  desktop:
    '<rect x="3" y="3.5" width="18" height="13" rx="2.5"/><path d="M3 13h18"/><path d="M10 16.5 9.5 20.5"/><path d="M14 16.5l.5 4"/><path d="M8 20.5h8"/>',
  /** a watch: its face, its straps and its crown */
  watch:
    '<rect x="6" y="6.5" width="11" height="11" rx="3"/><path d="M8.5 6.5 9 3h5l.5 3.5"/><path d="M8.5 17.5 9 21h5l.5-3.5"/><path d="M19.5 10.5v3"/>',
  /** a smart speaker: a cylinder, its top's rim and its grille */
  speakerSmart: `<path d="M6.5 6.5C6.5 4.6 9 3 12 3s5.5 1.6 5.5 3.5v11c0 1.9-2.5 3.5-5.5 3.5s-5.5-1.6-5.5-3.5Z"/><path d="M6.5 6.5c0 1.9 2.5 3.5 5.5 3.5s5.5-1.6 5.5-3.5"/>${LED(9.5, 14.5)}${LED(12, 15)}${LED(14.5, 14.5)}`,
  /** a remote: its ring of arrows over four keys */
  remote: `<rect x="7.5" y="3" width="9" height="18" rx="3"/><circle cx="12" cy="8.25" r="2"/>${LED(10.25, 13.5)}${LED(13.75, 13.5)}${LED(10.25, 17)}${LED(13.75, 17)}`,
  /** a game controller: its cross and two buttons */
  gameController: `<path d="M7.5 6.5h9a4 4 0 0 1 3.9 3.2l.85 4.6a2.4 2.4 0 0 1-4.2 2L15 14h-6l-2.05 2.3a2.4 2.4 0 0 1-4.2-2l.85-4.6A4 4 0 0 1 7.5 6.5Z"/><path d="M8 8.75v3.5"/><path d="M6.25 10.5h3.5"/>${LED(15.5, 9.75)}${LED(17.5, 11.5)}`,
  /** a server: two units, each its light and its bay */
  server: `<rect x="4" y="3.5" width="16" height="7.5" rx="2"/><rect x="4" y="13" width="16" height="7.5" rx="2"/>${LED(7.5, 7.25)}${LED(7.5, 16.75)}<path d="M11.5 7.25h5"/><path d="M11.5 16.75h5"/>`,
  /** a printer: the paper in at its back, its body, the page out at its front */
  printer: `<path d="M7 7.5v-4h10v4"/><path d="M7 16.5H5.5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H17"/><path d="M7 13.5h10v7H7Z"/>${LED(17, 10.5)}`,
} as const;
