import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/compass.json';

/** The Compass card's English, in its chunk: the card imports it first, so it is here before the card speaks. */
addEnglish(words);
