// the card's words first: they are here before it speaks
import './rounds/english.js';
import { registerCard } from '@fluvy/core';
import { ROUNDS_FAMILY } from './rounds-family.js';
import { FluvyRoundsCard } from './rounds/rounds-card.js';

/**
 * The Rounds card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands. Its
 * height lives in `rounds-family.ts`, which every page carries.
 */
export const CARDS = ROUNDS_FAMILY.map(
  ([tag]) => [tag, FluvyRoundsCard as CustomElementConstructor] as const,
);

for (const [tag, element] of CARDS) registerCard(tag, element);
