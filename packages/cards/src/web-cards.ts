// the card's words first: they are here before it speaks
import './web/english.js';
import { registerCard } from '@fluvy/core';
import { WEB_FAMILY } from './web-family.js';
import { FluvyWebCard } from './web/web-card.js';

/**
 * The web page card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands.
 * Its name, description and height live in `web-family.ts`, which every page carries.
 */
export const CARDS = WEB_FAMILY.map(
  ([tag, name, description]) =>
    [tag, FluvyWebCard as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
