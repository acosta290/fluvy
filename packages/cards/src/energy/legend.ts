import type { EntityView, HomeAssistant } from '@fluvy/core';
import { readout } from '@fluvy/ui';
import type { TemplateResult } from 'lit';
import { legendParts, shortName } from './power.js';

/** A legend's item: a sensor, and the label the card was given for it. */
export interface LegendItem {
  readonly entity: string;
  readonly label?: string;
}

/**
 * A legend row's readouts (the energy card's legend, the flow's totals): each item's label — or its sensor's short
 * name — over its figure, every figure of a family in one unit, chosen by the largest ("0.2 kWh" beside "1.2 kWh",
 * never "230 Wh").
 */
export function legendReadouts(
  hass: HomeAssistant | undefined,
  items: readonly LegendItem[],
  entity: (id: string) => EntityView,
): TemplateResult[] {
  const views = items.map((item) => entity(item.entity));
  const parts = legendParts(hass, views);
  return items.map((item, index) =>
    readout({
      label: item.label ?? shortName(views[index] as EntityView),
      value: parts[index]?.value ?? '—',
      unit: parts[index]?.unit ?? '',
      size: 's',
    }),
  );
}
