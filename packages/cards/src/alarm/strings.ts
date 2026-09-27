import { createStrings } from '@fluvy/core';

/**
 * Labels the alarm card owns. The four common actions (Arm home / away / night, Disarm) and
 * "Enter your code" are shared words and come from `@fluvy/core`.
 */
export const s = createStrings({
  en: {
    mode: 'Mode',
    armed: 'Armed',
    disarmed: 'Disarmed',
    home: 'Home',
    away: 'Away',
    night: 'Night',
    vacation: 'Vacation',
    custom: 'Custom',
    v_off: 'Off',
    v_perimeter: 'Perimeter',
    v_all: 'All zones',
    v_night: 'Sleeping',
    v_extended: 'Extended',
    v_bypass: 'Bypass',
    arm_vacation: 'Arm vacation',
    arm_custom: 'Arm custom',
    preview: 'Alarm',
  },
  es: {
    mode: 'Modo',
    armed: 'Armada',
    disarmed: 'Desarmada',
    home: 'En casa',
    away: 'Ausente',
    night: 'Noche',
    vacation: 'Vacaciones',
    custom: 'A medida',
    v_off: 'Apagada',
    v_perimeter: 'Perímetro',
    v_all: 'Total',
    v_night: 'Dormir',
    v_extended: 'Ausencia',
    v_bypass: 'Excepción',
    arm_vacation: 'Armar vacaciones',
    arm_custom: 'Armar a medida',
    preview: 'Alarma',
  },
});

/** Labels of the keypad sheet, which the lock card borrows. */
export const k = createStrings({
  en: {
    close: 'Close',
    cancel: 'Cancel',
    delete: 'Delete',
    digit: 'Digit {digit}',
    entered: '{count} digits entered',
    countdown: '{label} · {seconds} s',
    refused: 'Not accepted · try again',
  },
  es: {
    close: 'Cerrar',
    cancel: 'Cancelar',
    delete: 'Borrar',
    digit: 'Dígito {digit}',
    entered: '{count} dígitos introducidos',
    countdown: '{label} · {seconds} s',
    refused: 'No aceptado · inténtalo otra vez',
  },
});
