// the card's words first: they are here before it speaks
import './template/english.js';
import { registerCard } from '@fluvy/core';
import { TEMPLATE_FAMILY } from './template-family.js';
import { FluvyTemplateCard } from './template/template-card.js';

/**
 * The template card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands.
 * Its name, description and height live in `template-family.ts`, which every page carries.
 */
export const CARDS = TEMPLATE_FAMILY.map(
  ([tag, name, description]) =>
    [tag, FluvyTemplateCard as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
