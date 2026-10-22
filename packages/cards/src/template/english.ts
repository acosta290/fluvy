import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/template.json';

/** The template card's English, in its chunk: `template-cards.ts` imports it first, so it is here before the card speaks. */
addEnglish(words);
