import type { Tone } from '@fluvy/ui';

/*
 * A thermostat's tones (1.23, #219), one table for every card that draws one: the Thermostat card's dial and modes, what
 * says what it is doing (`doing.ts`), and the cards that list thermostats. A tone's colours are the palette's state
 * colours (`--fluvy-state-climate-heat` and its fill, its hairline and its ink on the fill: docs/theme.md), so a card of
 * one's own wears the same through the same variables.
 */

/** The tone a mode is drawn in: its dial, its ruler, its chip; off, the neutral. */
export const MODE_TONE: Readonly<Record<string, Tone>> = {
  heat: 'heat',
  cool: 'cool',
  heat_cool: 'accent',
  auto: 'accent',
  dry: 'dry',
  fan_only: 'fan',
  off: 'neutral',
};

/**
 * The tone an action's word wears, by what Home Assistant calls it (a climate's `hvac_action`, a humidifier's
 * `action`): what the device is doing, whatever mode it is in. Idle and off are quiet.
 */
export const ACTION_TONE: ReadonlyMap<string, Tone> = new Map([
  ['preheating', 'heat'],
  ['heating', 'heat'],
  ['defrosting', 'heat'],
  ['cooling', 'cool'],
  ['drying', 'dry'],
  ['fan', 'fan'],
  ['humidifying', 'water'],
  ['idle', 'neutral'],
  ['off', 'neutral'],
]);
