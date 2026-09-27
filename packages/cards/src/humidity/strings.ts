import { createStrings } from '@fluvy/core';

/** The humidity card's own words; Dry / Humid come from the shared strings. */
export const strings = createStrings({
  en: {
    relative: 'Relative humidity',
    comfortable: 'Comfortable',
    dew_point: 'Dew point',
    temperature: 'Temperature',
    trend: 'Trend',
    last_hours: 'Last {hours} h',
    low: 'Comfort from (%)',
    high: 'Comfort up to (%)',
    temperature_entity: 'Temperature entity (dew point)',
    humidifier_entity: 'Humidifier',
    trend_hours: 'Trend window in hours (0 hides it)',
  },
  es: {
    relative: 'Humedad relativa',
    comfortable: 'Confortable',
    dew_point: 'Punto de rocío',
    temperature: 'Temperatura',
    trend: 'Tendencia',
    last_hours: 'Últimas {hours} h',
    low: 'Confort desde (%)',
    high: 'Confort hasta (%)',
    temperature_entity: 'Entidad de temperatura (punto de rocío)',
    humidifier_entity: 'Humidificador',
    trend_hours: 'Ventana de la tendencia en horas (0 la oculta)',
  },
});
