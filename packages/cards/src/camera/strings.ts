import { createStrings } from '@fluvy/core';

/** Labels the camera card owns. "Live" stays the same word in both languages: the pill is 64 px wide. */
export const s = createStrings({
  en: {
    live: 'Live',
    snapshot: 'Snapshot',
    fullscreen: 'Fullscreen',
    view: 'Live view of {name}',
    offline: 'No image from the camera',
    refresh: 'Seconds between images',
  },
  es: {
    live: 'Live',
    snapshot: 'Captura',
    fullscreen: 'Pantalla completa',
    view: 'Vista en directo de {name}',
    offline: 'La cámara no envía imagen',
    refresh: 'Segundos entre imágenes',
  },
});
