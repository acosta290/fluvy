import type { EntityView, HomeAssistant } from '@fluvy/core';
import type { NumberOptions } from '../shared/units.js';
import { legendParts, shortName } from './power.js';
import type { Stat } from './stats.js';

/** A legend's item: a sensor, the name the card was given for it, and the unit and decimals of its own if any. */
export interface LegendItem extends NumberOptions {
  readonly entity: string;
  readonly name?: string;
}

/**
 * A legend row's statistics (the energy card's legend, the flow's totals, the grid's own readouts): each item's label
 * — or its sensor's short name — over its figure, every figure of a family in one unit, chosen by the largest
 * ("0.2 kWh" beside "1.2 kWh", never "230 Wh") or by what the card asks (`asked`); an item that asks for its own unit
 * or decimals reads as it asks. Drawn by `statsCols`.
 */
export function legendStats(
  hass: HomeAssistant | undefined,
  items: readonly LegendItem[],
  entity: (id: string) => EntityView,
  asked: NumberOptions = {},
): Stat[] {
  const views = items.map((item) => entity(item.entity));
  const parts = legendParts(hass, views, asked, items);
  return items.map((item, index) => ({
    label: item.name ?? shortName(views[index] as EntityView),
    value: parts[index]?.value ?? '—',
    unit: parts[index]?.unit ?? '',
    name: true,
  }));
}
