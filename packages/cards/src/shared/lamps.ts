import { plain } from '@fluvy/core';
import { APPLIANCE_WORDS, type ApplianceKind } from '../appliance/kinds.js';
import { LIGHT_WORDS } from '../strategy/words.generated.js';
import { says, type Rules } from './words.js';

/*
 * A lamp on a plug, by its name (#219): the rule the automatic dashboards count a room's lights by, which a Room lights
 * or Room card asked for `lamp_switches` reads too. Its chunk is the naming words' (`words`): fetched with the
 * strategy, and by the first card that asks, never by a dashboard that does not.
 */

/**
 * What a switch's name says it is, read plain: a light, else an appliance of a kind or never one (電気ケトル is a kettle
 * on its plug, not the light 電気; a light's words win over a kind's that stand apart: "oven light").
 */
const SWITCH_WORDS: Rules<'light' | ApplianceKind | 'never'> = [
  ['light', LIGHT_WORDS],
  ...APPLIANCE_WORDS,
];

/** Whether a switch is a lamp on a plug: its id and its name ("Workshop lamp", 工作室 电灯) say a light, in any language. */
export const isLampSwitch = (id: string, name: string): boolean =>
  id.startsWith('switch.') && says(plain(`${id} ${name}`), SWITCH_WORDS) === 'light';
