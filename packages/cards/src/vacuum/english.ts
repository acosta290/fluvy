import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/vacuum.json';

/**
 * The drive pad's English, in the Vacuum card's chunk: `vacuum-cards.ts` imports it first, so it is here before the
 * card speaks; the card's own words (`vacuum`) are core's, which the alerts say too.
 */
addEnglish(words);
