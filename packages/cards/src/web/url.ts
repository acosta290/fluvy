/*
 * What the web page card decides without a browser: whether an address may be framed, what the frame's sandbox says
 * at each level, and which of the plate's rounds its width holds.
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
const ENDS = 24;

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
