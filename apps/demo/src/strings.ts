import { createStrings } from '@fluvy/core';
import type { DemoLanguage } from './state.js';

/** The demo's own words (the cards, pages and panel carry theirs), in the two languages the demo offers. */
const en = {
  'brand.sub': 'Live demo',
  'family.home': 'Home',
  'family.devices': 'Devices',
  'family.climate': 'Climate',
  'family.energy': 'Energy',
  'family.media': 'Media',
  'family.time': 'Time',
  'family.helpers': 'Helpers',
  'page.panel': 'Settings',
  'page.activity': 'Activity',
  'page.history': 'History',
  'mode.light': 'Light',
  'mode.dark': 'Dark',
  'device.phone': 'Phone',
  'device.phone-l': 'Large phone',
  'device.tablet': 'Tablet',
  'device.desktop': 'Desktop',
  'palette.title': 'Palette',
  'palette.custom': 'Your own accent, in the settings panel',
  'links.install': 'Install',
  'links.github': 'GitHub',
  'banner.text':
    "A simulated home: Marta's flat on a Thursday evening. Every card, page and setting here is the real one; Home Assistant is stood in for by a small stand-in that changes state 140 ms after a service call. Nothing is connected.",
  'banner.ok': 'Got it',
  'notice.more_info': 'Opens the details of {entity} in Home Assistant',
  'notice.navigate': 'Opens {path} in Home Assistant',
  'notice.auto':
    'The automatic dashboard is built inside Home Assistant; the Dashboard tab shows a preview of it',
} as const;

const es: Record<keyof typeof en, string> = {
  'brand.sub': 'Demo en vivo',
  'family.home': 'Inicio',
  'family.devices': 'Dispositivos',
  'family.climate': 'Clima',
  'family.energy': 'Energía',
  'family.media': 'Multimedia',
  'family.time': 'Tiempo',
  'family.helpers': 'Ayudantes',
  'page.panel': 'Ajustes',
  'page.activity': 'Actividad',
  'page.history': 'Historial',
  'mode.light': 'Claro',
  'mode.dark': 'Oscuro',
  'device.phone': 'Móvil',
  'device.phone-l': 'Móvil grande',
  'device.tablet': 'Tableta',
  'device.desktop': 'Escritorio',
  'palette.title': 'Paleta',
  'palette.custom': 'Tu propio acento, en el panel de ajustes',
  'links.install': 'Instalar',
  'links.github': 'GitHub',
  'banner.text':
    'Una casa simulada: el piso de Marta un jueves por la noche. Cada tarjeta, página y ajuste es el real; a Home Assistant lo sustituye un doble pequeño que cambia el estado 140 ms después de cada llamada a un servicio. Nada está conectado.',
  'banner.ok': 'Entendido',
  'notice.more_info': 'Abre los detalles de {entity} en Home Assistant',
  'notice.navigate': 'Abre {path} en Home Assistant',
  'notice.auto':
    'El panel automático se construye dentro de Home Assistant; la pestaña Panel muestra una vista previa',
};

export type StringKey = keyof typeof en;

const strings = createStrings({ en, es });

/** A word of the demo in `language`. */
export const t = (
  language: DemoLanguage,
  key: StringKey,
  values?: Record<string, string | number>,
): string => strings({ language }, key, values);
