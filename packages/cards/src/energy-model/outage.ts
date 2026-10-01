import { formatTime, localize, resolveEntity, strings, type HomeAssistant } from '@fluvy/core';

const flow = strings('energy-flow');

/** A statistic of another integration (`tibber:energy_…`) has no entity to open or to ask the state of. */
export const isEntityId = (id: string | undefined): id is string =>
  typeof id === 'string' && id.includes('.') && !id.includes(':');

/**
 * The first meter of a period card that cannot be read now, in the words the flow uses for a source that went
 * down ("Grid unavailable since 21:35"): its figures stop where it stopped, and the head says so rather than
 * letting a short day pass for a quiet one.
 */
export function meterOutage(
  hass: HomeAssistant | undefined,
  meters: readonly { readonly id: string; readonly name: string }[],
): string | undefined {
  for (const { id, name } of meters) {
    if (!isEntityId(id)) continue;
    const status = resolveEntity(hass, id).status;
    if (status !== 'unavailable' && status !== 'missing') continue;
    const changed = Date.parse(hass?.states[id]?.last_changed ?? '');
    return Number.isFinite(changed)
      ? flow(hass, 'unavailable_since', { name, time: formatTime(hass, new Date(changed)) })
      : `${name} · ${localize(hass, 'state.unavailable').toLocaleLowerCase(hass?.language)}`;
  }
  return undefined;
}
