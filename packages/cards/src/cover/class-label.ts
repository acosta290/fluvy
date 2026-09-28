import { languageOf, speaks, strings, type HomeAssistant, type KeyOf } from '@fluvy/core';

/** The device classes Home Assistant reports for covers and valves, as the sub line's word — lowercase, after a "·". */
const coverStrings = strings('cover');

type CoverStringKey = KeyOf<'cover'>;

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
  if (hass && !speaks(languageOf(hass))) {
    const key = `component.${domain}.entity_component.${deviceClass}.name`;
    const text = hass.localize(key);
    if (text && text !== key) return text;
  }
  return coverStrings(hass, `class.${deviceClass}` as CoverStringKey);
}
