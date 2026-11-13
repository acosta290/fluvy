import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/customise.json';

/** Customise's English, in its own chunk: `customiser.ts` imports it first, so it is here before the section speaks. */
addEnglish(words);
