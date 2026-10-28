// the words first: the energy family's (the period's, which the followers share), then the cards' own
import './energy/english.js';
import './energy-period/english.js';
import './energy-usage/english.js';
import { registerCard } from '@fluvy/core';
import { ENERGY_PERIOD_FAMILY } from './energy-family.js';
import { FluvyEnergyPeriodCard } from './energy-period/energy-period-card.js';
import { FluvyEnergyUsageCard } from './energy-usage/energy-usage-card.js';

/**
 * The Energy period and Energy usage cards' elements: this module is their own chunk, fetched at start (`index.ts`)
 * and defined as it lands. Their names, descriptions and heights live in `energy-family.ts`, which every page carries.
 */
const ELEMENTS: Readonly<Record<string, CustomElementConstructor>> = {
  'fluvy-energy-period-card': FluvyEnergyPeriodCard,
  'fluvy-energy-usage-card': FluvyEnergyUsageCard,
};

export const CARDS = ENERGY_PERIOD_FAMILY.map(
  ([tag, name, description]) =>
    [tag, ELEMENTS[tag] as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
