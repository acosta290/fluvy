import { CARD_ICONS } from '@fluvy/ui';
import { ICON_PATHS } from './generated.js';

/** The prefix Home Assistant sees: `fluvy:sun`, `fluvy:blinds` … in every icon picker and every `<ha-icon>`. */
export const ICON_SET = 'fluvy';

interface CustomIconHelpers {
  path: string;
  /** What the glyph draws faint (a signal's bars it does not reach): Home Assistant draws it at half its colour. */
  secondaryPath?: string;
  viewBox?: string;
}
interface CustomIconSet {
  getIcon: (name: string) => Promise<CustomIconHelpers>;
  getIconList?: () => Promise<{ name: string; keywords?: string[] }[]>;
}

/**
 * The set's other parts (the appliances, a garage, a gate, a window, a door open, and the glyph sets of 1.23), which
 * no page needs until Home Assistant asks for one of their icons: fetched then. A fetch that fails draws nothing, as
 * an unknown name does.
 */
const onDemand = (): Promise<typeof import('./on-demand.js')> => import('./on-demand.js');

/** Core's part by any name Home Assistant asks for: one it does not hold has no path. */
const corePaths: Readonly<Record<string, string | undefined>> = ICON_PATHS;

/** The names Home Assistant lists for the set (every part). */
export const iconNames = async (): Promise<readonly string[]> => [
  ...Object.keys(ICON_PATHS),
  ...(await onDemand().then(
    (part) => part.names(),
    () => [],
  )),
];

/**
 * The outlines' grid with the set's scale undone (10/9 about the centre, Material's ink): the glyph's own ink, 3..21,
 * as a card draws it beside its strokes (`fluvy-card:`).
 */
const GLYPH_INK = '-1.33 -1.33 26.67 26.67';

/**
 * A glyph of the set as Home Assistant draws it (`fluvy:<name>`; `ink`: as a card draws it, `fluvy-card:<name>`): its
 * outline, and what it draws faint; '' for none.
 */
export async function iconOutline(name: string, ink = false): Promise<CustomIconHelpers> {
  const outline =
    corePaths[name] ??
    (await onDemand()
      .then((part) => part.outlineOf(name))
      .catch(() => undefined)) ??
    '';
  const [path, secondaryPath] = typeof outline === 'string' ? [outline] : outline;
  return {
    path,
    ...(secondaryPath ? { secondaryPath } : {}),
    viewBox: ink ? GLYPH_INK : '0 0 24 24',
  };
}

/**
 * Registers the fluvy glyphs as a Home Assistant icon set through the frontend's public
 * `window.customIcons` API (the one HACS icon packs use). The paths are the stroke glyphs of the
 * cards outlined to fills at build time, on the same 24 grid, so `fluvy:sun` in the sidebar is the
 * sun of the tile. Unknown names draw nothing rather than throwing inside `<ha-icon>`. Beside it, unlisted, the same
 * set on the glyphs' own ink (`fluvy-card:`), which a card draws a glyph no chunk has added through.
 */
export function registerIcons(): void {
  const host = window as unknown as {
    customIcons?: Record<string, CustomIconSet & { handOver?: (set: CustomIconSet) => void }>;
  };
  host.customIcons ??= {};
  const waiting = host.customIcons[ICON_SET];
  if (waiting && !waiting.handOver) return; // the real set is already there
  // the set as Fluvy's cards draw it, unlisted
  host.customIcons[CARD_ICONS] ??= { getIcon: (name) => iconOutline(name, true) };
  const set: CustomIconSet = {
    getIcon: (name) => iconOutline(name),
    getIconList: async () =>
      (await iconNames()).map((name) => ({ name, keywords: name.split('-') })),
  };
  host.customIcons[ICON_SET] = set;
  // the loader's stand-in (registered before the app rendered) answers the icons asked of it meanwhile
  waiting?.handOver?.(set);
}
