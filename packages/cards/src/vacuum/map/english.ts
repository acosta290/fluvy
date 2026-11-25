import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/vacuum-map.json';

/**
 * The map's English (#265), in the map's own chunk: every module that says a word of it imports this first, so it is
 * here before the map speaks, and a card that draws no map never carries it.
 */
addEnglish(words);
