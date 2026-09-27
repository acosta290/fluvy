import { createStrings } from '@fluvy/core';

/** Labels the lock card owns. Shared words (Slide to unlock, Slide to lock) live in `@fluvy/core`. */
export const s = createStrings({
  en: {
    unlock: 'Unlock',
    lock: 'Lock',
    open: 'Open door',
    unlock_label: 'Unlock {name}',
    lock_label: 'Lock {name}',
    press_again_unlock: 'Press again to unlock',
    press_again_lock: 'Press again to lock',
  },
  es: {
    unlock: 'Abrir',
    lock: 'Cerrar',
    open: 'Abrir puerta',
    unlock_label: 'Abrir {name}',
    lock_label: 'Cerrar {name}',
    press_again_unlock: 'Otra vez para abrir',
    press_again_lock: 'Otra vez para cerrar',
  },
});
