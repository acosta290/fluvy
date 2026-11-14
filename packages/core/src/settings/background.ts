import type { Hex } from '@fluvy/tokens/runtime';

/**
 * What lies behind the cards of a dashboard that wears the look (1.19, Discussion #155): the page's own colour, as every
 * page had it before (the default: nothing changes on upgrade), the palette's gradient (the mesh in the page's own hue),
 * a colour of the person's own or two (a gradient from the first, at the top, to the second), or a picture taken
 * towards the page's colour (its dim) so the words on the page read, out of focus if asked. The house's, in its
 * settings (Appearance › Background); a dashboard of ours may say its own (its strategy's `background`, the Dashboards
 * tab). The layer that draws it is `look/background-layer.ts`; the model lives here so the settings can hold it.
 */
export const BACKGROUND_TYPES = ['plain', 'gradient', 'color', 'image'] as const;
export type BackgroundType = (typeof BACKGROUND_TYPES)[number];

export interface PageBackground {
  readonly type: BackgroundType;
  /** `color`: one hex, or two (from the top to the bottom). */
  readonly colors: readonly Hex[];
  /** `image`: the picture's address, as `imageAddress` lets it through; '' none. */
  readonly image: string;
  /** `image`: how far it is taken towards the page's colour, in percent (0 to 80, in steps of 5). */
  readonly dim: number;
  /** `image`: out of focus. */
  readonly blur: boolean;
}

/** The most a picture is dimmed: past it the picture is the page's colour with a stain. */
export const BACKGROUND_DIM_MAX = 80;

/** The factory's: plain. A colour starts on the design's sage; a picture dimmed 40 %, in focus. */
export const BACKGROUND_DEFAULTS: PageBackground = {
  type: 'plain',
  colors: ['#dbe5d8'],
  image: '',
  dim: 40,
  blur: false,
};

/** The longest address kept: a path or a web address, never a document written into it. */
const ADDRESS_MAX = 2048;

/**
 * A picture's address: a path of Home Assistant's (`/local/…`, one slash first) or an `http`/`https` address with its
 * host, made of a URL's own characters and letters of any language, with the two joiners Persian and the Indic scripts
 * write their words with (ZWNJ, ZWJ) past its host's first letter. Never a quote, a parenthesis, a backslash, a
 * semicolon, a brace, an angle bracket, a control character, any other invisible one (a zero-width space, a direction
 * mark) or white space of any kind, so nothing it holds can end the CSS string it is written into (`url("…")`) or the
 * declaration around it, nor hide in it; never `data:`, `javascript:` or any other scheme (a picture lives on a server,
 * and the settings stay small), nor a name and a password before the host (`user:pass@host`, which a browser will not
 * send for a picture, and the settings would keep in the clear).
 */
const ADDRESS =
  /^(?:https?:\/\/(?![^/?#]*@)[^\s\p{Cc}\p{Cf}"'()\\;{}<>`^|/]|\/(?!\/))(?:[^\s\p{Cc}\p{Cf}"'()\\;{}<>`^|]|\u200c|\u200d)*$/iu;

/** A picture's address as Fluvy draws it (the space around it dropped), or undefined where it is not one. */
export function imageAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const address = value.trim();
  return address.length <= ADDRESS_MAX && ADDRESS.test(address) ? address : undefined;
}

const HEX = /^#[0-9a-f]{6}$/i;
const hexOf = (value: unknown): Hex | undefined =>
  typeof value === 'string' && HEX.test(value) ? (value.toLowerCase() as Hex) : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isBackgroundType = (value: unknown): value is BackgroundType =>
  (BACKGROUND_TYPES as readonly unknown[]).includes(value);

/**
 * A background, field by field: an unknown type, a colour that is not a hex (the first two kept), an address refused,
 * a dim off its 5 % steps or past 80 — anything missing or broken — is the default.
 */
export function parseBackground(raw: unknown): PageBackground {
  const value = isRecord(raw) ? raw : {};
  const d = BACKGROUND_DEFAULTS;
  const colors = Array.isArray(value['colors'])
    ? value['colors'].flatMap((color) => hexOf(color) ?? []).slice(0, 2)
    : [];
  const dim = value['dim'];
  return {
    type: isBackgroundType(value['type']) ? value['type'] : d.type,
    colors: colors.length ? colors : d.colors,
    image: imageAddress(value['image']) ?? d.image,
    dim:
      typeof dim === 'number' && dim >= 0 && dim <= BACKGROUND_DIM_MAX && dim % 5 === 0
        ? dim
        : d.dim,
    blur: typeof value['blur'] === 'boolean' ? value['blur'] : d.blur,
  };
}

/** Whether a background draws nothing of its own: plain, or a picture with no address. */
export const drawsNothing = (background: PageBackground): boolean =>
  background.type === 'plain' || (background.type === 'image' && !background.image);
