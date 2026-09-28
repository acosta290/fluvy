import type { HomeAssistant } from '@fluvy/core';
import type { FluvyHomeStrategyConfig } from './types.js';

const TAG = 'll-strategy-dashboard-fluvy-home';

/**
 * The automatic dashboard's strategy, defined for Home Assistant now and fetched when a dashboard asks for it:
 * `generate` returns the promise of the strategy's own file, so no page that never opens such a dashboard pays for
 * the registries' reading, the energy roles and the layout.
 */
export function defineHomeStrategy(): void {
  if (customElements.get(TAG)) return;
  customElements.define(
    TAG,
    class extends HTMLElement {
      static generate = (config: FluvyHomeStrategyConfig, hass: HomeAssistant) =>
        import('./generate.js').then((m) => m.generate(config, hass));
    },
  );
}
