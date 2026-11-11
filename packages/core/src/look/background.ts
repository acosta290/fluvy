import { drawsNothing, type PageBackground } from '../settings/background.js';
import type { WallBackground } from '../settings/schema.js';
import { WALL_ATTRIBUTE } from './attributes.js';
import type { Look } from './css.js';
import type { RootElement } from './tabs.js';

/*
 * The page's background on a dashboard's root (1.19, Discussion #155), as every page carries it: whether a root may wear
 * one at all. Which one it wears — none, the house's, or its dashboard's own — and the marks and the sheet that draw it
 * are the layer's (`background-layer.ts`), fetched the first time a root may wear one, so a house of plain pages never
 * fetches it.
 */

/** On `hui-root`: the background its view wears (`gradient`, `color` or `image`), drawn by the layer's sheet. */
export const BACKGROUND_ATTRIBUTE = 'fluvy-bg';

/**
 * Whether a wall keeps its own background on this page: on a wall the wall's own choice wins — its mesh, or plain — and
 * the dashboard's comes through only where the wall lets it (`dashboard`).
 */
export const wallKeepsOwn = (doc: Document, wall: WallBackground): boolean =>
  doc.documentElement.hasAttribute(WALL_ATTRIBUTE) && wall !== 'dashboard';

let layer: Promise<typeof import('./background-layer.js') | undefined> | undefined;

/**
 * Puts the background a root wears on it, given the house's where its dashboard wears the look (undefined where it does
 * not), or takes the one it wears off. The layer is fetched the first time the house draws one or a dashboard says its
 * own (its strategy's `background`); a root that may wear none and wears none is left as it is, and a stale build that
 * cannot fetch the layer leaves the page plain.
 */
export function paintRoot(
  root: RootElement,
  house: PageBackground | undefined,
  look: Look,
  dark: boolean,
): void {
  const strategy = root.lovelace?.rawConfig?.strategy;
  const own = typeof strategy === 'object' && strategy !== null && 'background' in strategy;
  if (!(house && (own || !drawsNothing(house))) && !root.hasAttribute(BACKGROUND_ATTRIBUTE)) return;
  layer ??= import('./background-layer.js').catch(() => undefined);
  void layer.then((module) => module?.paint(root, house, look, dark));
}
