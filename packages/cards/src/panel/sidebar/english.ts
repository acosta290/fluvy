import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/sidebar-editor.json';

/** The sidebar editor's English, in its own chunk: `editor.ts` imports it first, so it is here before the section speaks. */
addEnglish(words);
