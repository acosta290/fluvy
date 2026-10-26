import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/items.json';

/** The Items card's English, in its chunk: `items-cards.ts` imports it first, so it is here before the card speaks. */
addEnglish(words);
