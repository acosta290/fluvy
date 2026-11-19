// the card's words first: they are here before it speaks
import './rooms/english.js';
import { registerCard } from '@fluvy/core';
import { ROOMS_FAMILY } from './rooms-family.js';
import { FluvyRoomsCard } from './rooms/rooms-card.js';

/**
 * The Rooms card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands. Its
 * height lives in `rooms-family.ts`, which every page carries.
 */
export const CARDS = ROOMS_FAMILY.map(
  ([tag]) => [tag, FluvyRoomsCard as CustomElementConstructor] as const,
);

for (const [tag, element] of CARDS) registerCard(tag, element);
