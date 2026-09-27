import { createStrings } from '@fluvy/core';

/** Labels of the actions card. English is the source; Spanish mirrors it key for key. */
export const s = createStrings({
  en: {
    title: 'Actions',
    subtitle: 'Buttons & scripts',
    ran: 'ran {time}',
    never: 'never run',
    running: 'running now',
    done: 'Done',
    run: 'Run {name}',
  },
  es: {
    title: 'Acciones',
    subtitle: 'Botones y scripts',
    ran: 'a las {time}',
    never: 'sin ejecutar',
    running: 'en marcha',
    done: 'Hecho',
    run: 'Ejecutar {name}',
  },
});
