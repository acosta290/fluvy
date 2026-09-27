import { ICON_PATHS } from './generated.js';

/** The prefix Home Assistant sees: `fluvy:sun`, `fluvy:blinds` … in every icon picker and every `<ha-icon>`. */
export const ICON_SET = 'fluvy';

interface CustomIconHelpers {
  path: string;
  viewBox?: string;
}
interface CustomIconSet {
  getIcon: (name: string) => Promise<CustomIconHelpers>;
  getIconList: () => Promise<{ name: string; keywords?: string[] }[]>;
}

/** The names Home Assistant lists for the set, with the words a picker searches by. */
export const iconNames = (): readonly string[] => Object.keys(ICON_PATHS);

/**
 * Registers the fluvy glyphs as a Home Assistant icon set through the frontend's public
 * `window.customIcons` API (the one HACS icon packs use). The paths are the stroke glyphs of the
 * cards outlined to fills at build time, on the same 24 grid, so `fluvy:sun` in the sidebar is the
 * sun of the tile. Unknown names draw nothing rather than throwing inside `<ha-icon>`.
 */
export function registerIcons(): void {
  const host = window as unknown as {
    customIcons?: Record<string, CustomIconSet & { handOver?: (set: CustomIconSet) => void }>;
  };
  host.customIcons ??= {};
  const waiting = host.customIcons[ICON_SET];
  if (waiting && !waiting.handOver) return; // the real set is already there
  const set: CustomIconSet = {
    getIcon: async (name) => ({ path: ICON_PATHS[name] ?? '', viewBox: '0 0 24 24' }),
    getIconList: async () =>
      Object.keys(ICON_PATHS).map((name) => ({ name, keywords: name.split('-') })),
  };
  host.customIcons[ICON_SET] = set;
  // the loader's stand-in (registered before the app rendered) answers the icons asked of it meanwhile
  waiting?.handOver?.(set);
}
