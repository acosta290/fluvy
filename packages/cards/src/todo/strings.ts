import { createStrings } from '@fluvy/core';

/** Labels of the to-do card. English is the source; Spanish mirrors it key for key. */
export const s = createStrings({
  en: {
    empty: 'Nothing left',
    all_done: 'All done',
    close: 'Close',
    done: 'Done',
    todo: 'To do',
    hide_completed: 'Hide completed items',
  },
  es: {
    empty: 'No queda nada',
    all_done: 'Todo hecho',
    close: 'Cerrar',
    done: 'Hecho',
    todo: 'Pendiente',
    hide_completed: 'Ocultar los completados',
  },
});
