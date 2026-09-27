import { createStrings } from '@fluvy/core';

/** Labels of the timer card. English is the source; Spanish mirrors it key for key. */
export const s = createStrings({
  en: {
    running: 'Running',
    paused: 'Paused',
    elapsed: 'Elapsed',
    ends: 'Ends {time}',
    set_for: 'Set for {duration}',
    start: 'Start',
    resume: 'Resume',
    pause: 'Pause',
    cancel: 'Cancel',
  },
  es: {
    running: 'En marcha',
    paused: 'En pausa',
    elapsed: 'Transcurrido',
    ends: 'Termina a las {time}',
    set_for: 'Programado {duration}',
    start: 'Iniciar',
    resume: 'Reanudar',
    pause: 'Pausar',
    cancel: 'Cancelar',
  },
});
