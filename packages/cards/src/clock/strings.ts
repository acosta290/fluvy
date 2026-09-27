import { createStrings } from '@fluvy/core';
import { WEATHER_WORDS } from '../shared/weather.js';

/**
 * The clock's own words. Conditions and the compass are the library's (`WEATHER_WORDS`) but where a tile's state
 * line wants its own ("Clear night", not "Clear"; the shorter Spanish pair); the tile labels are the short pair
 * (a 142 px tile holds "SALIDA · PUESTA", not "AMANECER · ATARDECER").
 */
export const s = createStrings({
  en: {
    outside: 'Outside',
    unavailable: 'Unavailable',
    tonight: 'Tonight',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    sunrise_label: 'Sunrise',
    sunset_label: 'Sunset',
    feels: 'feels {value}',
    wind: 'wind {value}',
    ...WEATHER_WORDS.en,
    // a tile's state line names the night itself
    'clear-night': 'Clear night',
    'editor.layout': 'Layout',
    'editor.numerals': 'Numerals',
    'editor.date': 'Show the date',
    'editor.week': 'Show the week number',
    'editor.forecast': 'Forecast row (Outside · Tonight · Tomorrow)',
    'editor.hour12': '12-hour clock',
    'editor.time_zone': 'Time zone (IANA, e.g. Europe/Madrid)',
  },
  es: {
    outside: 'Fuera',
    unavailable: 'No disponible',
    tonight: 'Noche',
    sunrise: 'Amanecer',
    sunset: 'Atardecer',
    sunrise_label: 'Salida',
    sunset_label: 'Puesta',
    feels: 'sensación {value}',
    wind: 'viento {value}',
    ...WEATHER_WORDS.es,
    // a tile's state line is short
    partlycloudy: 'Algo nublado',
    pouring: 'Lluvia intensa',
    'editor.layout': 'Disposición',
    'editor.numerals': 'Números',
    'editor.date': 'Mostrar la fecha',
    'editor.week': 'Mostrar el número de semana',
    'editor.forecast': 'Fila de previsión (Fuera · Noche · Mañana)',
    'editor.hour12': 'Reloj de 12 horas',
    'editor.time_zone': 'Zona horaria (IANA, p. ej. Europe/Madrid)',
  },
});
