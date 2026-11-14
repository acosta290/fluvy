import { registerCard } from '@fluvy/core';
import { CLIMATE_FAMILY } from './climate-family.js';
import { FluvyThermostatCard } from './thermostat/thermostat-card.js';

/**
 * The Thermostat card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands.
 * Its name, description and height live in `climate-family.ts`, which every page carries; its words are core's.
 */
export const CARDS = CLIMATE_FAMILY.map(
  ([tag, name, description]) =>
    [tag, FluvyThermostatCard as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
