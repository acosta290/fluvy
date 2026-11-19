import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/rooms-card.json';

/** The Rooms card's English, in its chunk: `rooms-cards.ts` imports it first, so it is here before the card speaks. */
addEnglish(words);
