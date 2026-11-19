/*
 * The glyphs that say a level (1.23, #226): a battery's charge (the set's `battery` body, filled to it) and charging, a
 * signal's bars (the set's `signal` stroke, the bars it does not reach drawn faint), a valve open or shut (the pipe
 * symbol's bow tie, filled when shut). Fluvy draws them by itself where the house turns its icons' levels on
 * (`core/src/icons/levels.ts` adds them as its chunk lands); Home Assistant's icon picker and a card's
 * `icon: fluvy:battery-low` draw their outlines, the set's part `levels` (`tools/icons`). Same grid and hand as the
 * set: 24 grid, 1.75 round stroke (the signal's 2.2, as `signal`), ink 3..21 centred on (12, 12). The design lab keeps
 * the same table (`FLUVY.GLYPH_SETS` in `apps/design-lab/fluvy.js`); `glyphs.test.ts` holds them together. Nothing
 * here imports: the icon tools read it as it is.
 */

const BATTERY = '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21 11v2"/>';
const charge = (width: number): string =>
  `${BATTERY}<rect x="5" y="10" width="${width}" height="4" rx="1" fill="currentColor" stroke="none"/>`;

/** The signal's four bars, those past `lit` faint. */
const bars = (lit: number): string =>
  ['M4.5 18v-3', 'M9.5 18v-6', 'M14.5 18V9', 'M19.5 18V6']
    .map((d, at) => `<path d="${d}"${at < lit ? '' : ' opacity=".3"'}/>`)
    .join('');

const VALVE =
  '<path d="M3 14h3"/><path d="M18 14h3"/><path d="M6 9.5v9l12-9v9Z"/><path d="M12 14V5.5"/><path d="M8.5 5.5h7"/>';

export const LEVEL_GLYPHS = {
  /** a battery with nothing left: its body and its cap */
  batteryEmpty: BATTERY,
  /** a quarter of its charge */
  batteryLow: charge(3),
  /** half its charge */
  batteryHalf: charge(6),
  /** filled to the cap */
  batteryFull: charge(12),
  /** charging: a bolt through its body, the body cut clear of it */
  batteryCharging:
    '<path d="M9 8H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4.5"/><path d="M14.5 8H17a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M21 11v2"/><path d="M12.75 5.5 9.75 12h4.5l-3 6.5"/>',
  /** no bar reached: the four faint */
  signalNone: [bars(0), 2.2],
  /** one bar */
  signalWeak: [bars(1), 2.2],
  /** two bars */
  signalFair: [bars(2), 2.2],
  /** three bars */
  signalGood: [bars(3), 2.2],
  /** all four */
  signalStrong: [bars(4), 2.2],
  /** no signal at all: the four faint, crossed out in the corner they leave free (a person's pick, no level's) */
  signalOff: [`${bars(0)}<path d="m4 5.5 3.5 3.5"/><path d="M7.5 5.5 4 9"/>`, 2.2],
  /** a valve open: the bow tie of a pipe's valve, its handle on its stem */
  valveOpen: VALVE,
  /** shut: the bow tie filled */
  valveShut: `${VALVE}<path d="M6 9.5v9l12-9v9Z" fill="currentColor" stroke="none"/>`,
} as const satisfies Record<string, string | readonly [string, number]>;

export type LevelGlyphName = keyof typeof LEVEL_GLYPHS;
