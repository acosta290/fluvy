import { createStrings, type HomeAssistant } from '@fluvy/core';

/**
 * Labels the cover card owns. Shared words (Position, Tilt, Open, Stop, Close, Open / Closed) come
 * from `@fluvy/core` through `this.t()`; what lives here is the card's own copy and the device
 * classes Home Assistant reports for covers and valves — lowercase, because they follow a "·".
 */
export const coverStrings = createStrings({
  en: {
    favourites: 'Favourites',
    tilt_angle: 'Tilt in degrees: angle at 100 %',
    'class.awning': 'awning',
    'class.blind': 'blind',
    'class.curtain': 'curtain',
    'class.damper': 'damper',
    'class.door': 'door',
    'class.garage': 'garage',
    'class.gate': 'gate',
    'class.shade': 'shade',
    'class.shutter': 'shutter',
    'class.window': 'window',
    'class.water': 'water',
    'class.gas': 'gas',
  },
  es: {
    favourites: 'Favoritos',
    tilt_angle: 'Inclinación en grados: ángulo al 100 %',
    'class.awning': 'toldo',
    'class.blind': 'persiana',
    'class.curtain': 'cortina',
    'class.damper': 'compuerta',
    'class.door': 'puerta',
    'class.garage': 'garaje',
    'class.gate': 'portón',
    'class.shade': 'estor',
    'class.shutter': 'contraventana',
    'class.window': 'ventana',
    'class.water': 'agua',
    'class.gas': 'gas',
  },
});

export type CoverStringKey = Parameters<typeof coverStrings>[1];

const CLASSES = new Set([
  'awning',
  'blind',
  'curtain',
  'damper',
  'door',
  'garage',
  'gate',
  'shade',
  'shutter',
  'window',
  'water',
  'gas',
]);

/**
 * The device class as a word for the sub line, or '' when the integration reports none we know.
 * English and Spanish are ours (lowercase by the copy rules); any other language takes Home
 * Assistant's own translation as it comes, since not every language lowercases its nouns.
 */
export function coverClassLabel(
  hass: Pick<HomeAssistant, 'language' | 'localize'> | undefined,
  domain: string,
  deviceClass: string,
): string {
  if (!CLASSES.has(deviceClass)) return '';
  const language = (hass?.language ?? 'en').split('-')[0];
  if (hass && language !== 'en' && language !== 'es') {
    const key = `component.${domain}.entity_component.${deviceClass}.name`;
    const text = hass.localize(key);
    if (text && text !== key) return text;
  }
  return coverStrings(hass, `class.${deviceClass}` as CoverStringKey);
}
