import { createStrings } from '@fluvy/core';

/** Play, pause, previous, next and volume are shared words (`media.*`). */
export const s = createStrings({
  en: { progress: '{position} of {duration}', muted: 'muted' },
  es: { progress: '{position} de {duration}', muted: 'silenciado' },
});
