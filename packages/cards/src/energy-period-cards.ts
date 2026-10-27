// the words first: the energy family's (the period's, which the followers share), then the card's own
import './energy/english.js';
import './energy-period/english.js';
import { registerCard } from '@fluvy/core';
import { ENERGY_PERIOD_FAMILY } from './energy-family.js';
import { FluvyEnergyPeriodCard } from './energy-period/energy-period-card.js';

/**
 * The Energy period card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it
 * lands. Its name, description and height live in `energy-family.ts`, which every page carries.
 */
export const CARDS = ENERGY_PERIOD_FAMILY.map(
  ([tag, name, description]) =>
    [tag, FluvyEnergyPeriodCard as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
