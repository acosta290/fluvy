// the energy family's words first (the card's are among them): they are here before it speaks
import './energy/english.js';
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
