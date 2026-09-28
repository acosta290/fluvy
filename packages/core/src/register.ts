import type { CustomCardEntry, LovelaceCardConfig } from './ha/types.js';
import { declareHeight } from './layout-heights.js';

export interface CardMeta extends Omit<CustomCardEntry, 'type'> {
  /** Custom element tag, which is also the card type after the `custom:` prefix. */
  readonly tag: string;
}

/**
 * Every tag is defined synchronously while the module evaluates: Home Assistant gives a custom card
 * two seconds to exist before it paints an error card, and an `await` before `define` loses that race.
 */
export function registerCard(meta: CardMeta, element: CustomElementConstructor): void {
  if (!customElements.get(meta.tag)) customElements.define(meta.tag, element);
  // a card that knows its height at a 360 column says so here, for whoever lays cards out
  const { layoutHeight } = element as { layoutHeight?: unknown };
  if (typeof layoutHeight === 'function')
    declareHeight(meta.tag, layoutHeight as (config: LovelaceCardConfig) => number);
  const cards = (window.customCards ??= []);
  if (!cards.some((card) => card.type === meta.tag)) {
    const { tag, ...rest } = meta;
    cards.push({ type: tag, preview: true, ...rest });
  }
}
