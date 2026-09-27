/** The Activity page's shared constants and small types (its modules: view, rail, header, filters, rows, detail, sources). */
import { domainOf, type HassEntity } from '@fluvy/core';

import { type GlyphName, type Tone } from '@fluvy/ui';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
/** The sticky hour header: a row settles just under it. */
export const HOUR_HEAD = 40;
/** A quiet stretch longer than this between two entries draws the spine dashed. */
export const QUIET = 30 * MINUTE;
/** Entries of a burst or a repeat shown before "Show all". */
export const INNER = 20;
/** Rows that rise in, one after another, when a period arrives. */
export const STAGGER = 10;
/**
 * A phone's layout below this width: the thin rail, the time in the second line, stacked details. The desktop's day
 * header (a 32 px title beside its four controls) needs about this much.
 */
export const COMPACT = 720;
/** A row's pitch until one is laid out: 12 + the 40 circle + 12. */
export const ROW = 64;
/** Times a settle may chase its row while the hours it passes are laid out under it. */
export const CHASES = 24;
/** The list leaves before the next period comes in. */
export const EXIT = 160;

/** Home Assistant's own words for the domains whose state is a moment (a button pressed, a scene activated). */
export const MOMENTS: Record<string, string> = {
  button: 'pressed',
  input_button: 'pressed',
  scene: 'activated',
  tag: 'scanned',
  image: 'updated',
  notify: 'sent',
  wake_word: 'detected',
  stt: 'detected',
  tts: 'sent',
  conversation: 'ran',
  ai_task: 'ran',
  infrared: 'command_sent',
  radio_frequency: 'command_sent',
};

/** Home Assistant's English trigger phrases, as its own logbook reads them (the backend sends them untranslated). */
export const TRIGGERS = [
  'numeric state of',
  'state of',
  'event',
  'time pattern',
  'time',
  'Home Assistant stopping',
  'Home Assistant starting',
] as const;
export const TRIGGER_KEYS: Record<(typeof TRIGGERS)[number], string> = {
  'numeric state of': 'numeric_state_of',
  'state of': 'state_of',
  event: 'event',
  'time pattern': 'time_pattern',
  time: 'time',
  'Home Assistant stopping': 'homeassistant_stopping',
  'Home Assistant starting': 'homeassistant_starting',
};

/** Domains whose entries are the house's small print: a dot on the spine, not an icon circle. */
export const MINOR = new Set([
  'sensor',
  'binary_sensor',
  'event',
  'button',
  'input_button',
  'device_tracker',
  'sun',
  'zone',
]);

export const PICKED = 'logbookPickedValue';
export const FILTERS = 'logbookSourceFilters';

/** A date whose day number never leaves its neighbours on a line of its own ("September 17", "17 de"). */
export const keepDay = (text: string): string =>
  text.replace(/(\d{1,2}) /g, '$1\u00a0').replace(/ (\d{1,2})\b/g, '\u00a0$1');

/** What the activity can show: not a continuous value (a counter, a sensor with a unit). */
export const logbookEntity = (stateObj: HassEntity): boolean => {
  const domain = domainOf(stateObj.entity_id);
  if (domain === 'counter' || domain === 'proximity') return false;
  return !(
    domain === 'sensor' &&
    (stateObj.attributes.unit_of_measurement !== undefined ||
      stateObj.attributes['state_class'] !== undefined)
  );
};

/**
 * A point of the scroll ↔ time map: at scroll position `s` (a row under the pinned hour header), moment `t`.
 * `row` marks the rows themselves (where a scrub settles).
 */
export interface Anchor {
  readonly s: number;
  readonly t: number;
  readonly row?: boolean;
}

/** A row's place in the day: the spine through it, dashed across a quiet stretch above or below. */
export interface Place {
  readonly gap: boolean;
  readonly gapAfter: boolean;
  readonly index: number;
}

export interface Look {
  readonly glyph: GlyphName | string;
  readonly tone: Tone;
  /** An icon circle (what people look for) or a small dot (the house's housekeeping). */
  readonly major: boolean;
}
