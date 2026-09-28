import type { HomeAssistant } from '@fluvy/core';
import type { FluvyStrategyConfig, TemplateId } from './types.js';

/** The automatic dashboards, each a strategy: `custom:fluvy-<id>` (`templates.ts` lists the same five). */
export const TEMPLATE_IDS: readonly TemplateId[] = ['home', 'rooms', 'energy', 'security', 'wall'];

/**
 * The automatic dashboards' strategies, defined for Home Assistant now and fetched when a dashboard asks for one:
 * `generate` returns the promise of the strategy's own file, so no page that never opens such a dashboard pays
 * for the registries' reading, the energy roles and the layout.
 */
export function defineStrategies(): void {
  for (const id of TEMPLATE_IDS) {
    const tag = `ll-strategy-dashboard-fluvy-${id}`;
    if (customElements.get(tag)) continue;
    customElements.define(
      tag,
      class extends HTMLElement {
        static generate = (config: FluvyStrategyConfig, hass: HomeAssistant) =>
          import('./generate.js').then((m) => m.generate(config, hass));
      },
    );
  }
}
