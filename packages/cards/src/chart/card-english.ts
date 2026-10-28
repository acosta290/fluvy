import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/chart-card.json';

/**
 * The Chart card's English, a part of its own in its chunk (the engine's, `english.ts`, is the engine's chunk's):
 * `chart-cards.ts` imports it first, so it is here before the card speaks.
 */
addEnglish(words);
