import { registerCard } from '@fluvy/core';
import { FluvyCompassCard } from './compass/compass-card.js';
import { WEATHER_FAMILY } from './weather-family.js';
import { FluvyWeatherCard } from './weather/weather-card.js';

/**
 * The weather and compass cards' elements: this module is their chunk, fetched at start (`index.ts`) and defined as
 * it lands. Their heights live in `weather-family.ts`, which every page carries.
 */
const ELEMENTS: Readonly<Record<string, CustomElementConstructor>> = {
  'fluvy-weather-card': FluvyWeatherCard as CustomElementConstructor,
  'fluvy-compass-card': FluvyCompassCard as CustomElementConstructor,
};

export const CARDS = WEATHER_FAMILY.map(([tag]) => [tag, ELEMENTS[tag]!] as const);

for (const [tag, element] of CARDS) registerCard(tag, element);
