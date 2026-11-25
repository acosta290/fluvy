import { isActive, localize, plural, type EntityView, type HomeAssistant } from '@fluvy/core';
import type { Tone } from '@fluvy/ui';

/** What a set of entities says of itself: "2 of 4 on" while something is on, "4 devices" ("1 device") when nothing is. */
export function counted(
  hass: HomeAssistant | undefined,
  ids: readonly string[],
  entity: (id: string) => EntityView,
): string {
  if (ids.length === 0) return '';
  const on = ids.filter((id) => isActive(entity(id))).length;
  if (on > 0) return localize(hass, 'common.on_of', { on, count: ids.length });
  return plural(hass, 'common.devices', ids.length, { count: ids.length });
}

/**
 * What a head's badge says of a set (the Entities card's count, the Room lights card's, #261): "2 on" in `tone` while
 * something is on — "On" where the card counts none (`counts`) — else "Off", neutral.
 */
export const onBadge = (
  hass: HomeAssistant | undefined,
  on: number,
  tone: Tone,
  counts = true,
): { text: string; tone: Tone } => {
  const word = localize(hass, on ? 'common.on' : 'common.off');
  return on && counts
    ? { text: `${on} ${word.toLowerCase()}`, tone }
    : { text: word, tone: on ? tone : 'neutral' };
};

/**
 * "2 of 4 on" in its shorter forms, longest first ("2/4 on", then "2/4"): a line too narrow for the words keeps the
 * count. Devices count in the shared words; a card that counts something else says its own (the automations card,
 * whose words a language may count with another word: Japanese 件, where a device is 台).
 */
export const onOfShort = (
  hass: HomeAssistant | undefined,
  on: number,
  count: number,
  said = localize(hass, 'common.on_of_short', { on, count }),
): string[] => [said, `${on}/${count}`];
