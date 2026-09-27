import { createStrings } from '@fluvy/core';

export const s = createStrings({
  en: {
    title: 'Energy flow',
    live: 'Live',
    seconds_ago: '{count} s ago',
    solar_share: '{percent} % solar',
    charging: 'Charging',
    discharging: 'Discharging',
    house: 'House',
    editor_grid_invert: 'Grid: positive means exporting',
    editor_battery_invert: 'Battery: positive means charging',
    editor_battery_level: 'Battery level',
    editor_home: 'House power (optional: worked out when empty)',
    editor_readouts: 'Totals under the diagram (up to 3)',
  },
  es: {
    title: 'Flujo de energía',
    live: 'En directo',
    seconds_ago: 'hace {count} s',
    solar_share: '{percent} % solar',
    charging: 'Cargando',
    discharging: 'Descargando',
    house: 'Casa',
    editor_grid_invert: 'Red: positivo significa exportar',
    editor_battery_invert: 'Batería: positivo significa cargar',
    editor_battery_level: 'Nivel de la batería',
    editor_home: 'Potencia de la casa (opcional: se calcula si falta)',
    editor_readouts: 'Totales bajo el diagrama (hasta 3)',
  },
});
