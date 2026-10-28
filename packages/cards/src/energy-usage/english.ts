import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/energy-usage.json';

/** The Energy usage card's English, in its chunk: `energy-period-cards.ts` imports it first, so it is here before the card speaks. */
addEnglish(words);
