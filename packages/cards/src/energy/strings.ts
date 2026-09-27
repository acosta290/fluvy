import { createStrings } from '@fluvy/core';

export const s = createStrings({
  en: {
    title: 'Energy',
    right_now: 'Right now',
    cost: 'Cost',
    last_hours: 'Last {hours} h',
    hours_ago: '−{count} h',
    days_ago: '−{count} d',
    no_history: 'No history yet',
    editor_legend: 'Totals under the chart (up to 3)',
  },
  es: {
    title: 'Energía',
    right_now: 'Ahora mismo',
    cost: 'Coste',
    last_hours: 'Últimas {hours} h',
    hours_ago: '−{count} h',
    days_ago: '−{count} d',
    no_history: 'Aún sin historial',
    editor_legend: 'Totales bajo la gráfica (hasta 3)',
  },
});
