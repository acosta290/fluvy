import { createStrings } from '@fluvy/core';

/** The production card's own words. Shared ones (Today…) come from `this.t()`. */
export const strings = createStrings({
  en: {
    production: 'Production',
    so_far: 'So far today',
    forecast: 'Forecast',
    vs_forecast: 'vs forecast',
    peak: 'Peak',
    peak_at: 'Peak at',
    sun_hours: 'Sun hours',
    hour: 'h',
    forecast_entity: 'Forecast entity',
    peak_entity: 'Peak power entity',
  },
  es: {
    production: 'Producción',
    so_far: 'Hoy hasta ahora',
    forecast: 'Previsión',
    vs_forecast: 'vs. previsión',
    peak: 'Pico',
    peak_at: 'Hora pico',
    sun_hours: 'Horas sol', // "Horas de sol" is wider than a 76 px column
    hour: 'h',
    forecast_entity: 'Entidad de previsión',
    peak_entity: 'Entidad de potencia pico',
  },
});
