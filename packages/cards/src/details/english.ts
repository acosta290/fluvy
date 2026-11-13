import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/sheets.json';

/** The details sheets' English, in their chunk: `sheet.ts` imports it first, so it is here before a sheet speaks. */
addEnglish(words);
