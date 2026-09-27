import { createStrings } from '@fluvy/core';

export const s = createStrings({
  en: {
    window_hours: 'last {count} h',
    window_days: 'last {count} days',
    hours_ago: '−{count} h',
    days_ago: '−{count} d',
    state: 'State',
    no_history: 'No history for this window',
    'editor.show_stats': 'Show min / max / average',
  },
  es: {
    window_hours: 'últimas {count} h',
    window_days: 'últimos {count} días',
    hours_ago: '−{count} h',
    days_ago: '−{count} d',
    state: 'Estado',
    no_history: 'Sin historial en este periodo',
    'editor.show_stats': 'Mostrar mín. / máx. / media',
  },
});
