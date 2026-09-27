import { createStrings } from '@fluvy/core';

/**
 * The gauge's own words. The label in the open centre comes from Home Assistant's device-class
 * names when the frontend has them; these cover the common ones when it does not.
 */
export const strings = createStrings({
  en: {
    value: 'Value',
    active: 'Active',
    energy: 'Energy',
    temperature: 'Temperature',
    pressure: 'Pressure',
    speed: 'Speed',
    illuminance: 'Light',
    current: 'Current',
    voltage: 'Voltage',
    max_entity: 'Maximum from an entity',
    label: 'Label inside the ring',
    badge: 'Badge text',
  },
  es: {
    value: 'Valor',
    active: 'Activo',
    energy: 'Energía',
    temperature: 'Temperatura',
    pressure: 'Presión',
    speed: 'Velocidad',
    illuminance: 'Luz',
    current: 'Corriente',
    voltage: 'Tensión',
    max_entity: 'Máximo desde una entidad',
    label: 'Texto dentro del anillo',
    badge: 'Texto de la insignia',
  },
});
