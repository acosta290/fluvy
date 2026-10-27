// the card's words first: they are here before it speaks
import './chart/card-english.js';
import { registerCard } from '@fluvy/core';
import { CHART_FAMILY } from './chart-family.js';
import { FluvyChartCard } from './chart/chart-card.js';

/**
 * The Chart card's element: this module is its own chunk (`chart-card`, beside the engine's), fetched at start
 * (`index.ts`) and defined as it lands. Its name, description and height live in `chart-family.ts`, which every page
 * carries.
 */
export const CARDS = CHART_FAMILY.map(
  ([tag, name, description]) =>
    [tag, FluvyChartCard as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
