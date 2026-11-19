import {
  areaOf,
  areasInOrder,
  isUsable,
  usableEntity,
  type EntityView,
  type HomeAssistant,
} from '@fluvy/core';
import { modeWord } from '../shared/mode-words.js';

/*
 * What the Thermostats card reads of the house beyond its rows (1.23, #230, #219): the thermostats it lists where its
 * config lists none, and the presets they offer between them. The card's and its height's (`house-heights.ts`): one
 * rule for what it draws and what it declares.
 */

/**
 * The thermostats a card lists where its config lists none: every climate of its area, else of the house, in the
 * house's order of its rooms (those in no room last), a room's by id; a water heater or a humidifier only where it
 * is listed. An entity the house hides, or a setting's, is never one.
 */
export function houseThermostats(hass: HomeAssistant | undefined, area?: string): string[] {
  if (!hass) return [];
  const rooms = areasInOrder(hass).map((one) => one.area_id);
  const place = (id: string): number => {
    const at = rooms.indexOf(areaOf(hass, id) ?? '');
    return at < 0 ? rooms.length : at;
  };
  return Object.keys(hass.states)
    .filter(
      (id) =>
        id.startsWith('climate.') && usableEntity(hass, id) && (!area || areaOf(hass, id) === area),
    )
    .sort((a, b) => place(a) - place(b) || (a < b ? -1 : 1));
}

/** A preset the thermostats offer between them: its key, its word, and how many of those that can be read offer it. */
export interface Offered {
  readonly key: string;
  readonly word: string;
  readonly offered: number;
}

/**
 * The presets the thermostats that can be read offer between them (`preset_modes`; Home Assistant's `none` is no
 * preset), in the order they first offer them, each in the word of the first that does (Home Assistant's own where
 * Fluvy speaks the page's language, `modeWord`) and with how many offer it. A unit out of reach offers nothing.
 */
export function presetsOffered(
  hass: HomeAssistant | undefined,
  views: readonly EntityView[],
): Offered[] {
  const found = new Map<string, { word: string; offered: number }>();
  for (const view of views.filter(isUsable))
    for (const key of new Set(view.attr<unknown[]>('preset_modes') ?? []))
      if (typeof key === 'string' && key && key !== 'none') {
        const seen = found.get(key);
        if (seen) seen.offered += 1;
        else found.set(key, { word: modeWord(hass, view, 'preset_mode', key), offered: 1 });
      }
  return [...found].map(([key, { word, offered }]) => ({ key, word, offered }));
}

/**
 * A preset chip's words: the preset's, and how many of the thermostats that can be read offer it where some do not
 * ("Eco 3/5"); offered by every one, its word alone.
 */
export const presetLabel = ({ word, offered }: Offered, usable: number): string =>
  offered < usable ? `${word} ${offered}/${usable}` : word;
