import { createStrings } from '@fluvy/core';

/** Labels of the updates card. English is the source; Spanish mirrors it key for key. */
export const s = createStrings({
  en: {
    title: 'Updates',
    checked: 'Checked {time}',
    available: '{count} available',
    one_available: '1 available',
    up_to_date: 'Up to date',
    all_up_to_date: 'Everything is up to date',
    install: 'Install',
    install_named: 'Install {name}',
    installing: 'installing {percent} %',
    working: 'installing',
    versions: '{from} → {to}',
    show_up_to_date: 'Show what is up to date',
    toggle: 'Switch under the list',
  },
  es: {
    title: 'Actualizaciones',
    checked: 'Comprobado {time}',
    available: '{count} disponibles',
    one_available: '1 disponible',
    up_to_date: 'Al día',
    all_up_to_date: 'Todo está al día',
    install: 'Instalar',
    install_named: 'Instalar {name}',
    installing: 'instalando {percent} %',
    working: 'instalando',
    versions: '{from} → {to}',
    show_up_to_date: 'Mostrar lo que está al día',
    toggle: 'Interruptor bajo la lista',
  },
});
