import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/web.json';

/** The web page card's English, in its chunk: `web-cards.ts` imports it first, so it is here before the card speaks. */
addEnglish(words);
