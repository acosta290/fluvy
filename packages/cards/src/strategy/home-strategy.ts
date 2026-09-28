/**
 * `custom:fluvy-home` — the dashboard a new install gets without configuring anything: its views (Home, Rooms,
 * Lights, Climate, Energy, Security, Media, Agenda, Sensors — each when the house has what it shows) built from
 * the entity, device and area registries and from the energy dashboard's own preferences, in the layout of the
 * approved `/fluvy-home`. The other templates (`templates.ts`) are built the same way.
 *
 * Every card is a fluvy card. A section that would be empty is left out, a view without content is
 * left out. Every view opens with the greeting and the tabs and is three columns wide, so the header
 * never moves when the tab changes. Names come from the entities themselves (the cards resolve
 * them), titles from the dashboard's language.
 */

import { generate } from './generate.js';

export type { FluvyHomeStrategyConfig } from './types.js';
export { houseEnergy } from './context.js';

/** The strategy as one class, for what holds the whole of it (the tests); Home Assistant meets it through `define.ts`. */
export class FluvyHomeStrategy {
  static generate = generate;
}
