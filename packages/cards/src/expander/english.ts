import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/expander.json';

/** The Expander card's English, in its chunk: `expander-cards.ts` imports it first, so it is here before the card speaks. */
addEnglish(words);
