import { createStrings } from '@fluvy/core';
import { WEATHER_WORDS } from '../shared/weather.js';

/**
 * The weather card's words: the conditions and the compass are the library's (`WEATHER_WORDS`), the hero line
 * uses them in the languages fluvy ships (elsewhere the card asks Home Assistant).
 */
const en = {
  ...WEATHER_WORDS.en,
  feels: 'Feels {value}',
  'editor.forecast': 'Forecast',
};

export type WeatherString = keyof typeof en;

export const s = createStrings<WeatherString>({
  en,
  es: {
    ...WEATHER_WORDS.es,
    feels: 'Sensación {value}',
    'editor.forecast': 'Previsión',
  },
});
