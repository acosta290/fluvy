import { createStrings } from '@fluvy/core';

/**
 * The fan card's own labels. Speed, Oscillate, Direction and Preset come from the shared table
 * (`this.t()`); the words under the ruler and the two directions live here.
 */
export const fanStrings = createStrings({
  en: {
    low: 'Low',
    mid: 'Mid',
    high: 'High',
    forward: 'Forward',
    reverse: 'Reverse',
  },
  es: {
    low: 'Baja',
    mid: 'Media',
    high: 'Alta',
    forward: 'Normal',
    reverse: 'Inversa',
  },
});
