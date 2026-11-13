import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/details.json';

/**
 * The details dialog's history in English, in its chunk: `view.ts` imports it first, so it is here before the block
 * speaks.
 */
addEnglish(words);
