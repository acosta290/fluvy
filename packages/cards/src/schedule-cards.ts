// the card's words first: they are here before it speaks
import './schedule/english.js';
import { registerCard } from '@fluvy/core';
import { SCHEDULE_FAMILY } from './schedule-family.js';
import { FluvyScheduleCard } from './schedule/schedule-card.js';

/**
 * The Heating schedule card's element (#229): this module is its own chunk, fetched at start (`index.ts`) and defined
 * as it lands. Its height lives in `schedule-family.ts`, which every page carries; its sheet is a chunk of its own,
 * fetched the first time it is opened.
 */
export const CARDS = SCHEDULE_FAMILY.map(
  ([tag]) => [tag, FluvyScheduleCard as CustomElementConstructor] as const,
);

for (const [tag, element] of CARDS) registerCard(tag, element);
