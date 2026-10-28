import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/chart.json';

/** The chart engine's English, in its chunk: the engine imports it first, so it is here before a gauge speaks. */
addEnglish(words);
