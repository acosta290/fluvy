import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/sidebar.json';

/** The dashboard sidebar's English, in its chunk: `index.ts` imports it first, so it is here before the sidebar speaks. */
addEnglish(words);
