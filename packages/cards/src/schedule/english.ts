import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/schedule.json';

/**
 * The Heating schedule card's English, in its chunk: `schedule-cards.ts` imports it first, so it is here before the
 * card speaks (the sheet's chunk imports this one's, so the sheet finds it too).
 */
addEnglish(words);
