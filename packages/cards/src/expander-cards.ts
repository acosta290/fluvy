// the card's words first: they are here before it speaks
import './expander/english.js';
import { registerCard } from '@fluvy/core';
import { EXPANDER_FAMILY } from './expander-family.js';
import { FluvyExpanderCard } from './expander/expander-card.js';

/**
 * The Expander card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands.
 * Its name, description and height live in `expander-family.ts`, which every page carries.
 */
export const CARDS = EXPANDER_FAMILY.map(
  ([tag, name, description]) =>
    [tag, FluvyExpanderCard as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
