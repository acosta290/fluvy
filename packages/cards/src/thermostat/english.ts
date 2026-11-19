import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/thermostat.json';

/** The Thermostat card's own English, in its chunk: the card imports it first, so it is here before the card speaks. */
addEnglish(words);
