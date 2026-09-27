import { strings, type KeyOf } from '@fluvy/core';

/**
 * The weather card's words: the conditions and the compass are the catalogue's `weather` namespace, which the
 * hero line uses in the languages Fluvy ships (elsewhere the card asks Home Assistant).
 */
export type WeatherString = KeyOf<'weather'>;

export const s = strings('weather');
