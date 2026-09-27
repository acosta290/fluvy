import { createStrings } from '@fluvy/core';

/** Labels only the media card says. Shared words (volume, mute, play…) live in `@fluvy/core`'s `media.*` keys. */
export const s = createStrings({
  en: {
    unmute: 'Unmute',
    position: 'Position',
    last_played: 'last played {time}',
    since: 'since {time}',
    repeat_off: 'Repeat off',
    repeat_all: 'Repeat all',
    repeat_one: 'Repeat one',
    artwork: 'Album art',
  },
  es: {
    unmute: 'Activar sonido',
    position: 'Posición',
    last_played: 'última reproducción {time}',
    since: 'desde {time}',
    repeat_off: 'Sin repetición',
    repeat_all: 'Repetir todo',
    repeat_one: 'Repetir una',
    artwork: 'Carátula',
  },
});
