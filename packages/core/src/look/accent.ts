import {
  accentFamily,
  accentFamilyVars,
  declarationsCss,
  DEFAULT_PALETTE,
  litFlip,
  litFull,
  litSurface,
  paletteAccent,
  parsePaletteKey,
  resolveAccent,
  seedOf,
  splitStatuses,
  surfaceInset,
  surfaceWash,
  textInk,
  type AccentFamily,
  type Hex,
  type PaletteMode,
  type PaletteChoice,
  type PaletteModeColors,
  type RoleColors,
} from '@fluvy/tokens/runtime';
import { paletteOf } from './css.js';

/**
 * A card's own colour: what it redefines inside the card, derived on the palette the card wears (`--fluvy-palette`)
 * in the mode it is in, and written into the card's shadow root — never on the host, whose computed values the
 * card reads (the sentinel, the palette), and without `!important`: a child's own declaration wins over what it
 * would inherit from the host, and no host rule reads the accent.
 */

/** The declarations a colour writes on a palette × mode, derived once and kept (the last 128). */
const kept = new Map<string, string>();
const KEPT = 128;
/** The inks tones and colours are drawn in, per palette × mode (`AccentSheet.inkOf`), kept the same way. */
const inks = new Map<string, string>();
/** From which level a light card in its light's whole colour wears the fill's inks (`flipOf`), kept the same way. */
const flips = new Map<string, number>();

function remember<T>(map: Map<string, T>, key: string, value: T): T {
  map.delete(key);
  map.set(key, value);
  if (map.size > KEPT) map.delete(map.keys().next().value as string);
  return value;
}

/** The palette a key names, the default where the key is not one of ours (a page without a look). */
const choiceOf = (paletteKey: string): PaletteChoice =>
  parsePaletteKey(splitStatuses(paletteKey).palette) ?? DEFAULT_PALETTE;

/** One mode of the palette a key names, in the house's status colours its key carries (`statusesKey`). */
export const colorsOf = (paletteKey: string, mode: PaletteMode): PaletteModeColors =>
  paletteOf(choiceOf(paletteKey), splitStatuses(paletteKey).statuses)[mode];

/**
 * What wears a colour as it is named (1.25, #250: Home Assistant's own value for a name, a hex as given, drawn exactly),
 * fetched by the first card that asks (`card.ts`); a card that wears the palette's tones has none.
 */
export type ExactColours = typeof import('@fluvy/tokens/exact');

/** What a derivation's key says of a card that wears its colours as named: a family of its own, kept apart. */
const named = (exact: ExactColours | undefined): string => (exact ? '|exact' : '');

/** A 2D context, once: how the browser itself reads a colour (none where there is no canvas, as under test). */
let painter: CanvasRenderingContext2D | null | undefined;

/**
 * Any other CSS colour (`hsl(…)`, `rebeccapurple`, `color(…)`) as the browser reads it, `#rrggbb` or `rgba(…)`:
 * read from two different starts, so a value the browser refuses (it keeps the one before) is nothing.
 */
function cssColour(text: string): string | undefined {
  if (painter === undefined)
    painter =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!painter) return undefined;
  painter.fillStyle = '#000000';
  painter.fillStyle = text;
  const read = String(painter.fillStyle);
  painter.fillStyle = '#ffffff';
  painter.fillStyle = text;
  return read === String(painter.fillStyle) ? read : undefined;
}

/**
 * What a card's `color` (a name, a hex, `rgb(…)`, a triplet, or any CSS colour the browser reads) is on this
 * palette × mode — a name as the palette has it, or as Home Assistant does where the card wears its colours as named
 * (`exact`); undefined: the accent itself.
 */
export function accentHex(
  paletteKey: string,
  mode: PaletteMode,
  choice: unknown,
  exact?: ExactColours,
): Hex | undefined {
  if (choice === undefined || choice === null || choice === '') return undefined;
  const colors = colorsOf(paletteKey, mode);
  const resolve = exact?.exactHex ?? resolveAccent;
  const hex = resolve(choice, colors);
  if (hex || typeof choice !== 'string') return hex;
  const css = cssColour(choice);
  return css === undefined ? undefined : resolve(css, colors);
}

/** An item's `primary` or `accent`: the palette's own accent by name, which it wears under a card's colour too. */
export const PALETTE_ACCENT = 'accent';
const asksForAccent = (choice: unknown): boolean =>
  typeof choice === 'string' && /^\s*(primary|accent)\s*$/i.test(choice);

/**
 * A lit white drawn by its warmth (`light_whites: temperature`, 1.10): this mark, then its colour as Home Assistant
 * gives it (`white #ffa757`) — derived on the whites' scale, not by its hue as a colour is (`accentFamily`).
 */
export const WHITE = 'white ';
const isWhite = (choice: unknown): choice is string =>
  typeof choice === 'string' && /^white #[0-9a-f]{6}$/.test(choice);

/** The family a colour (`#rrggbb`) or a white (`WHITE`) has on a palette × mode, or worn as named (`exact`). */
const familyOf = (
  paletteKey: string,
  mode: PaletteMode,
  pick: string,
  exact: ExactColours | undefined,
): AccentFamily => {
  const seed = seedOf(choiceOf(paletteKey));
  const colors = colorsOf(paletteKey, mode);
  return exact
    ? exact.exactFamily(seed, colors, pick.slice(-7))
    : accentFamily(seed, colors, pick.slice(-7), pick.startsWith(WHITE));
};

/** What the palette's own accent writes inside a card, kept like a colour's family. */
export function paletteAccentCss(paletteKey: string, mode: PaletteMode): string {
  const key = `own|${paletteKey}|${mode}`;
  const known = kept.get(key);
  if (known !== undefined) return known;
  const colors = colorsOf(paletteKey, mode);
  return remember(kept, key, declarationsCss(accentFamilyVars(paletteAccent(colors), colors)));
}

/**
 * What a card's own surface colour (`card_color`) writes: the card's fill as a wash of the colour, the card's edge
 * and dividers in the colour's hairline and its inner fills the wash's deeper step (`--fluvy-inset`), derived on the
 * palette × mode and kept like the accent's family.
 */
export function surfaceCss(
  paletteKey: string,
  mode: PaletteMode,
  pick: Hex,
  exact?: ExactColours,
): string {
  const key = `surface|${paletteKey}|${mode}|${pick}${named(exact)}`;
  const known = kept.get(key);
  if (known !== undefined) return known;
  const colors = colorsOf(paletteKey, mode);
  const family = familyOf(paletteKey, mode, pick, exact);
  return remember(
    kept,
    key,
    declarationsCss([
      ['--fluvy-card', surfaceWash(family, colors)],
      ['--fluvy-border', family.fillBorder],
      ['--fluvy-inset', surfaceInset(family, colors)],
    ]),
  );
}

/** A see-through card's sheet from a solid one's, on a palette × mode (`look/glass.ts`). */
export type GlassWriter = (paletteKey: string, mode: PaletteMode, css: string) => string;

/** The state a tone is drawn in (`ui`'s tones table, whose `state-*` tones these are); any other: the accent. */
export const TONE_STATES: Readonly<Record<string, keyof PaletteModeColors['state']>> = {
  light: 'light-active',
  heat: 'climate-heat',
  cool: 'climate-cool',
  dry: 'climate-dry',
  fan: 'climate-fan',
  water: 'energy-water',
  solar: 'energy-solar',
  grid: 'energy-grid',
  media: 'media-playing',
  presence: 'presence-home',
  armed: 'security-armed',
  battery: 'energy-battery',
  house: 'energy-home',
  gas: 'energy-gas',
  vehicle: 'energy-water',
};

/** The status a tone is drawn in (`ui`'s tones table): a warning, a danger, what is good. */
const TONE_STATUSES: Readonly<Record<string, keyof PaletteModeColors['semantic']>> = {
  warning: 'warning',
  danger: 'danger',
  ok: 'success',
};

/** A lit surface in its light's whole colour as the lamp is bright (`full_brightness`): this mark, then its colour. */
const FULL = 'full ';

/**
 * What a lit surface is lit in on a palette × mode — a colour's family (`#rrggbb`, a white's: `WHITE`) or a tone of the
 * palette's own (`light`: its lit light; a status: `warning`, `danger`, `ok`, `notice`) — and the names it is drawn by: a
 * colour's, the accent's and the lit light's, as its family writes them.
 */
function litRole(
  paletteKey: string,
  mode: PaletteMode,
  source: string,
  exact: ExactColours | undefined,
): readonly [RoleColors, readonly string[]] {
  const colors = colorsOf(paletteKey, mode);
  const state = TONE_STATES[source];
  const status = TONE_STATUSES[source];
  return source.includes('#')
    ? [familyOf(paletteKey, mode, source, exact), ['accent', 'state-light-active']]
    : state
      ? [colors.state[state], [`state-${state}`]]
      : status
        ? [colors.semantic[status], [status]]
        : source === 'notice'
          ? [colors.notice, ['notice']]
          : [colors.accent, ['accent']];
}

/**
 * What a lit surface (a light card's `tint`, 1.9) writes for what it is lit in (`litRole`) at `level` (0 at rest):
 * `litSurface`; in its light's whole colour (`FULL`), `litFull`. Kept like the rest.
 */
export function litCss(
  paletteKey: string,
  mode: PaletteMode,
  source: string,
  level: number,
  exact?: ExactColours,
): string {
  const key = `lit|${paletteKey}|${mode}|${source}|${level}${named(exact)}`;
  const known = kept.get(key);
  if (known !== undefined) return known;
  const colors = colorsOf(paletteKey, mode);
  const full = source.startsWith(FULL);
  const [role, names] = litRole(paletteKey, mode, full ? source.slice(FULL.length) : source, exact);
  return remember(
    kept,
    key,
    declarationsCss(full ? litFull(role, colors, level, names) : litSurface(role, colors, level)),
  );
}

/** A figure's ink in what it is said in on a palette × mode (`AccentSheet.ink`: `textInk`), kept like the inks. */
/** What a sheet's selector may name: a tone of the palette's (`heat`, `accent`) or a colour (`#rrggbb`). */
const SOURCE = /^(?:#[0-9a-f]{3,8}|[a-z][a-z0-9-]*)$/i;

function textOf(
  paletteKey: string,
  mode: PaletteMode,
  source: string,
  exact: ExactColours | undefined,
): string {
  const key = `text|${paletteKey}|${mode}|${source}${named(exact)}`;
  return (
    inks.get(key) ??
    remember(
      inks,
      key,
      textInk(litRole(paletteKey, mode, source, exact)[0], colorsOf(paletteKey, mode)),
    )
  );
}

/** From which level a light card in its light's whole colour wears the fill's inks on a palette × mode (`litFlip`). */
function flipOf(
  paletteKey: string,
  mode: PaletteMode,
  source: string,
  exact: ExactColours | undefined,
): number {
  const key = `${paletteKey}|${mode}|${source}${named(exact)}`;
  const known = flips.get(key);
  if (known !== undefined) return known;
  return remember(
    flips,
    key,
    litFlip(litRole(paletteKey, mode, source, exact)[0], colorsOf(paletteKey, mode)),
  );
}

export function accentCss(
  paletteKey: string,
  mode: PaletteMode,
  pick: string,
  exact?: ExactColours,
): string {
  const key = `${paletteKey}|${mode}|${pick}${named(exact)}`;
  const known = kept.get(key);
  if (known !== undefined) return known;
  return remember(
    kept,
    key,
    declarationsCss(
      accentFamilyVars(familyOf(paletteKey, mode, pick, exact), colorsOf(paletteKey, mode)),
    ),
  );
}

/**
 * The sheet a card adopts for its colours: the card's own (`:host > *`) and those of its items (`[data-accent]`,
 * one rule per colour used). `wears()` tells it which palette and mode the card is in; `host()` and `item()` are
 * asked while the card renders; `commit()` writes the sheet once, and only when something changed.
 */
export class AccentSheet {
  private readonly sheet = new CSSStyleSheet();
  /** Unset until the card says what it wears: the first `wears()` is always a change. */
  private paletteKey = '';
  private mode: PaletteMode = 'light';
  private hostPick: Hex | undefined;
  private surfacePick: Hex | undefined;
  /** Each item's colour by its `data-accent`: a hex, or the palette's own accent (`PALETTE_ACCENT`). */
  private items = new Set<string>();
  /** Each lit surface by its `data-surface`: what it is lit in and how far (`<source>-<level %>`). */
  private surfaces = new Set<string>();
  /** Each surface that says a tone at its edge alone, by its `data-edge`: what the edge is drawn in. */
  private edges = new Set<string>();
  /** Each figure said in a tone's words, by its `data-ink` (a reading in its band, 1.22, #204): what it is said in. */
  private texts = new Set<string>();
  /** What writes a see-through card's sheet (1.15, `look/glass.ts`): none while it is solid. */
  private see: GlassWriter | undefined;
  /** What wears the colours the card names as they are named (1.25, #250): none while it wears the palette's tones. */
  private exact: ExactColours | undefined;
  private written = '';

  /** Adopted once into the card's shadow root, beside its stylesheets. */
  adopt(root: ShadowRoot): void {
    if (!root.adoptedStyleSheets.includes(this.sheet))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.sheet];
  }

  /** The palette and mode the card wears; true when either changed (the colours must be derived again). */
  wears(paletteKey: string, mode: PaletteMode): boolean {
    const key = paletteKey || DEFAULT_PALETTE;
    if (key === this.paletteKey && mode === this.mode) return false;
    this.paletteKey = key;
    this.mode = mode;
    return true;
  }

  /** The card's own colour, as configured. */
  host(choice: unknown): void {
    this.hostPick = accentHex(this.paletteKey, this.mode, choice, this.exact);
  }

  /** The card's own surface colour (`card_color`), as configured: a wash of it as the card's fill, its hairline as the edge. */
  surface(choice: unknown): void {
    this.surfacePick = accentHex(this.paletteKey, this.mode, choice, this.exact);
  }

  /** The card is see-through (its writer) or solid (none): its surfaces, its washes and its wells at its opacity. */
  glass(writer: GlassWriter | undefined): void {
    this.see = writer;
  }

  /**
   * Forgets the items' colours, the lit surfaces, the edges and the figures' inks before a render asks for them again,
   * in the colours as the card names them this render (`exact`) or the palette's tones of them.
   */
  begin(exact?: ExactColours): void {
    this.exact = exact;
    this.items = new Set();
    this.surfaces = new Set();
    this.edges = new Set();
    this.texts = new Set();
  }

  /**
   * What a colour is on the card's palette: a hex, a lit white (`WHITE`), the palette's own accent where it is named
   * (`primary`, `accent`), or nothing — none given, Home Assistant's `state`, a word no colour answers to.
   */
  pick(choice: unknown): string | undefined {
    return asksForAccent(choice)
      ? PALETTE_ACCENT
      : isWhite(choice)
        ? choice
        : accentHex(this.paletteKey, this.mode, choice, this.exact);
  }

  /**
   * An item's colour, as configured: the value for its `data-accent` (`pick`), or nothing when it has none of its
   * own (it wears the card's).
   */
  item(choice: unknown): string | undefined {
    const value = this.pick(choice);
    if (value) this.items.add(value);
    return value;
  }

  /**
   * The ink a series is drawn in on the palette the card wears: a tone of the palette's (`heat`, `water`, the
   * `accent`, a status), or a colour of the user's (`#rrggbb`, as `accentCss` derives its family). Nothing for a tone
   * without an ink of its own (`off`, `neutral`). What tells two curves apart (the sensor card's ΔE gate).
   */
  inkOf(source: string): Hex | undefined {
    const paletteKey = this.paletteKey || DEFAULT_PALETTE;
    const key = `ink|${paletteKey}|${this.mode}|${source}${named(this.exact)}`;
    const known = inks.get(key);
    if (known !== undefined) return known || undefined;
    const colors = colorsOf(paletteKey, this.mode);
    const state = TONE_STATES[source];
    const status = TONE_STATUSES[source];
    const ink = source.startsWith('#')
      ? familyOf(paletteKey, this.mode, source, this.exact).ink
      : state
        ? colors.state[state].ink
        : status
          ? colors.semantic[status].ink
          : source === 'notice'
            ? colors.notice.ink
            : source === 'accent' || source === PALETTE_ACCENT
              ? colors.accent.ink
              : '';
    return remember(inks, key, ink) || undefined;
  }

  /**
   * A lit surface: the value for its `data-surface` — lit in a colour (`#rrggbb`, a white) or a tone of the palette's, at
   * `level` (0 at rest, else the lamp's share, in 5 % steps).
   */
  lit(source: string, level: number): string {
    const key = `${source}-${Math.round(level * 20) * 5}`;
    this.surfaces.add(key);
    return key;
  }

  /**
   * A surface that says a tone at its edge alone (a card tinted `edge`, 1.22, #196): the value for its `data-edge` —
   * what the edge is drawn in, a tone of the palette's or a colour (`inkOf`).
   */
  edge(source: string): string {
    this.edges.add(source);
    return source;
  }

  /**
   * A figure said in a tone (a reading in the band a threshold names, 1.22, #204): the value for its `data-ink` — a
   * tone of the palette's or a colour (`litRole`), its ink as the words of a figure (`textInk`, 4.5 on the card, the
   * page and the tone's own wash) in `--fv-ink`.
   */
  ink(source: string): string {
    this.texts.add(source);
    return source;
  }

  /**
   * A lit surface in its light's whole colour, following the lamp (`full_brightness`, 1.17), at `level` (the lamp's
   * share, in 5 % steps): the value for its `data-surface` — none at 100 %, the whole fill, a lit tile's as `full`'s —
   * and whether the card wears the fill's inks there (a lit tile's skin) or its own (a wash's): the same at a step every
   * time, so they change at one step, the same up and down.
   */
  litFull(source: string, level: number): { readonly surface?: string; readonly onFill: boolean } {
    const step = Math.round(level * 20) / 20;
    if (step >= 1) return { onFill: true };
    return {
      surface: this.lit(FULL + source, step),
      onFill: step >= flipOf(this.paletteKey, this.mode, source, this.exact),
    };
  }

  /**
   * Writes the sheet: the host's colour and surface on the card's children, each item's on its `data-accent`, then
   * each lit surface on its `data-surface` (after the host's: a lit card's surface is over its `card_color`), each
   * edge's ink on its `data-edge` and each figure's on its `data-ink`; a see-through card's through its writer.
   */
  commit(): void {
    const rules: string[] = [];
    const { paletteKey, mode, exact } = this;
    const host =
      (this.hostPick ? accentCss(paletteKey, mode, this.hostPick, exact) : '') +
      (this.surfacePick ? surfaceCss(paletteKey, mode, this.surfacePick, exact) : '');
    if (host) rules.push(`:host > *{${host}}`);
    for (const value of this.items)
      rules.push(
        `[data-accent="${value}"]{${
          value === PALETTE_ACCENT
            ? paletteAccentCss(paletteKey, mode)
            : accentCss(paletteKey, mode, value, exact)
        }}`,
      );
    for (const key of this.surfaces) {
      const dash = key.lastIndexOf('-');
      rules.push(
        `[data-surface="${key}"]{${litCss(paletteKey, mode, key.slice(0, dash), Number(key.slice(dash + 1)) / 100, exact)}}`,
      );
    }
    for (const source of this.edges) {
      const ink = this.inkOf(source);
      if (ink) rules.push(`[data-edge="${source}"]{--fv-edge:${ink}}`);
    }
    // a source is a tone's name or a colour the card picked (`#rrggbb`): anything else never reaches the sheet
    for (const source of this.texts)
      if (SOURCE.test(source))
        rules.push(`[data-ink="${source}"]{--fv-ink:${textOf(paletteKey, mode, source, exact)}}`);
    const own = rules.join('');
    const css = this.see ? this.see(paletteKey, mode, own) : own;
    if (css === this.written) return;
    this.written = css;
    this.sheet.replaceSync(css);
  }
}
