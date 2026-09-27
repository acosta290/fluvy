import { createStrings } from '@fluvy/core';

export const s = createStrings({
  en: {
    title: 'Who is home',
    count: '{home} of {total}',
    updated: 'updated {when}',
    map: 'Open the map',
    'editor.map_path': 'Map path',
  },
  es: {
    title: 'En casa',
    count: '{home} de {total}',
    updated: 'actualizado {when}',
    map: 'Abrir el mapa',
    'editor.map_path': 'Ruta del mapa',
  },
});
