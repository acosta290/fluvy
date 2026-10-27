/*
 * What the web page card decides without a browser: whether an address may be framed, what the frame's sandbox says
 * at each level, which of the plate's rounds its width holds, and where a state's words go on the plate.
 */

/** Where the dashboard is: what a relative address resolves against, and whether the page itself is served over https. */
export interface Place {
  readonly href: string;
  readonly protocol: string;
}

/**
 * An address as the card reads it: its href and host where it may be framed; `insecure` where the dashboard is served
 * over https and the page over http (a browser blocks the frame, and says nothing to the page); `refused` where the
 * scheme is not http or https (`javascript:`, `data:`, `blob:`, nothing) or the address cannot be read at all.
 */
export type WebUrl =
  | { readonly state: 'ok' | 'insecure'; readonly href: string; readonly host: string }
  | { readonly state: 'refused' };

/** The address of a config (`url`), resolved at `place` as a browser would resolve a link (a relative address allowed). */
export function webUrl(value: unknown, place: Place): WebUrl {
  if (typeof value !== 'string' || !value.trim()) return { state: 'refused' };
  let url: URL;
  try {
    url = new URL(value, place.href);
  } catch {
    return { state: 'refused' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { state: 'refused' };
  const insecure = place.protocol === 'https:' && url.protocol === 'http:';
  return { state: insecure ? 'insecure' : 'ok', href: url.href, host: url.host };
}

/** How far the framed page is let go: Home Assistant's own set, a stricter one, or no sandbox at all. */
export type SandboxLevel = 'standard' | 'strict' | 'off';

/** Home Assistant's `IFRAME_SANDBOX`, as its iframe card writes it: what a page framed on a dashboard may do by default. */
const STANDARD =
  'allow-forms allow-popups allow-pointer-lock allow-same-origin allow-scripts allow-modals allow-downloads';
/** The strict level: the page runs and takes input, but keeps no identity (no `allow-same-origin`), opens nothing and downloads nothing. */
const STRICT = 'allow-forms allow-pointer-lock allow-scripts';
/** Home Assistant's `allow_open_top_navigation`: the page may send this tab elsewhere on a tap. */
const TOP_NAVIGATION = 'allow-top-navigation-by-user-activation';

/** The frame's `sandbox` attribute at a level, with top navigation where it is asked for; none at `off` (the attribute left out). */
export function sandboxOf(level: SandboxLevel, topNavigation: boolean): string | undefined {
  if (level === 'off') return undefined;
  const base = level === 'strict' ? STRICT : STANDARD;
  return topNavigation ? `${base} ${TOP_NAVIGATION}` : base;
}

/** The plate's rounds, in the order they are drawn: reload, open in a new tab, full screen at the end. */
export type Round = 'reload' | 'open' | 'fullscreen';
const ORDER: readonly Round[] = ['reload', 'open', 'fullscreen'];
/** A round (44) with the 8 between rounds; the row's 12 at each end. */
const ROUND = 44;
const GAP = 8;
const EDGE = 12;
const ENDS = 2 * EDGE;

/**
 * The rounds a plate `width` wide holds of those `wanted` (whichever were asked for), in their drawn order: 44 each, 8
 * apart, 12 in from each end. Where they do not all fit, the reload round goes first, then the open round; the
 * full-screen round stays (no plate is narrower than one round and its ends).
 */
export function roundsFit(width: number, wanted: readonly Round[]): Round[] {
  let kept = ORDER.filter((name) => wanted.includes(name));
  while (kept.length > 1 && ENDS + kept.length * ROUND + (kept.length - 1) * GAP > width)
    kept = kept.slice(1);
  return kept;
}

/** What the rounds take at a plate's foot: a round and the 12 under it. */
const FOOT = ROUND + EDGE;
/** What a state's words keep from the plate's sides, and from the rounds beside them. */
const SIDE = 16;
/** What a state keeps above and below it, in the room over the rounds: the least, it is centred there. */
const CLEAR = 8;
/** The state's glyph (the 44 off circle) and the 8 under it; a line of words; the slow state's line with its 44 link. */
const GLYPH = 44;
const STACK_GAP = 8;
const LINE = 24;
const LINK_LINE = 44;

/** A plate as a state reads it: its width, its height (unbounded where the view or the screen decides it), its rounds. */
export interface PlateRoom {
  readonly width: number;
  readonly height: number;
  readonly rounds: number;
}

/**
 * What a state is made of, measured: its words' width in full and in their short form, the slow state's link with
 * what joins it to the words (none where it offers none), and whether a glyph stands over the words (the off plate).
 */
export interface StateMeasures {
  readonly full: number;
  readonly short: number;
  readonly link?: number;
  readonly glyph?: boolean;
}

/**
 * Where a state goes and what of it: `above` the rounds, centred in the room the plate leaves over them (8 at least
 * above and below it), or `beside` them at the plate's start; the glyph over the words or not; the words in full, in
 * their short form or none; the link on the words' line. `top` is where the state starts on the plate, on the 4 grid
 * (none where the view or the screen decides the plate's height: its box is centred there); `reserve` what its box
 * leaves the rounds — their 56 under it, or their span and its gaps at its end.
 */
export interface StateLayout {
  readonly place: 'above' | 'beside';
  readonly glyph: boolean;
  readonly words: 'full' | 'short' | 'none';
  readonly link: boolean;
  readonly top?: number;
  readonly reserve: number;
}

/**
 * A state's words on a plate, never under its rounds and never cut: the first of these the plate holds — the glyph
 * over the words in full, then over their short form; the words in full with the link on their line (the slow
 * state's); the words alone, in full, then short; the same beside the rounds' row, where a plate is wide and low; the
 * glyph alone. None where nothing holds (a half card's plate of 68): its skin and its rounds say the rest.
 */
export function stateLayout(plate: PlateRoom, state: StateMeasures): StateLayout | undefined {
  const span = plate.rounds ? plate.rounds * ROUND + (plate.rounds - 1) * GAP : 0;
  const foot = plate.rounds ? FOOT : 0;
  const across = plate.width - 2 * SIDE;
  const beside = plate.rounds ? plate.width - 2 * SIDE - span - EDGE : 0;
  /** The block a state stacks above the rounds: the glyph, the 8 under it, the line (44 with its link). */
  const block = ({ glyph, words, link }: StateLayout): number =>
    (glyph ? GLYPH : 0) +
    (words === 'none' ? 0 : link ? LINK_LINE : LINE) +
    (glyph && words !== 'none' ? STACK_GAP : 0);
  const holds = (layout: StateLayout): boolean => {
    const { place, glyph, words, link } = layout;
    const line =
      (words === 'full' ? state.full : words === 'short' ? state.short : 0) +
      (link ? (state.link ?? 0) : 0);
    if (place === 'beside') return line <= beside;
    return (
      block(layout) + 2 * CLEAR <= plate.height - foot &&
      line <= across &&
      (!glyph || GLYPH <= across)
    );
  };
  const above = (glyph: boolean, words: StateLayout['words'], link = false): StateLayout => {
    const layout: StateLayout = { place: 'above', glyph, words, link, reserve: foot };
    const free = plate.height - foot - block(layout);
    return Number.isFinite(free) ? { ...layout, top: Math.floor(free / 8) * 4 } : layout;
  };
  const besides = (words: StateLayout['words']): StateLayout => ({
    place: 'beside',
    glyph: false,
    words,
    link: false,
    reserve: EDGE + span + SIDE,
  });
  const glyph = state.glyph === true;
  return [
    ...(glyph ? [above(true, 'full'), above(true, 'short')] : []),
    ...(state.link === undefined ? [] : [above(false, 'full', true)]),
    above(false, 'full'),
    above(false, 'short'),
    besides('full'),
    besides('short'),
    ...(glyph ? [above(true, 'none')] : []),
  ].find(holds);
}
