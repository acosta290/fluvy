import { registerCard } from '@fluvy/core';
import { THERMOSTATS_FAMILY } from './thermostats-family.js';
import { FluvyThermostatsCard } from './thermostats/thermostats-card.js';

/**
 * The Thermostats card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it
 * lands. Its height lives in `thermostats-family.ts`, which every page carries; its English comes with the card.
 */
export const CARDS = THERMOSTATS_FAMILY.map(
  ([tag]) => [tag, FluvyThermostatsCard as CustomElementConstructor] as const,
);

for (const [tag, element] of CARDS) registerCard(tag, element);
