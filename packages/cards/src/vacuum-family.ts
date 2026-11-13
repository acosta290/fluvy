import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { chipBlock, chipRows, COMPACT } from './shared/heights.js';
import { pretty } from './shared/mode-words.js';

/**
 * The Vacuum card, announced at start and defined when its chunk lands (`vacuum-cards.ts`), as the Slider card is:
 * what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page carries
 * this file: it stays tiny.
 */

export type Command = 'start' | 'pause' | 'stop' | 'dock' | 'locate';

/** What a robot does, each by its bit of `supported_features`; 0 where its kind has none. */
export type RobotBits = Readonly<Record<Command | 'suction' | 'battery', number>>;

export const VACUUM_BITS: RobotBits = {
  pause: 4,
  stop: 8,
  dock: 16,
  suction: 32,
  battery: 64,
  locate: 512,
  start: 8192,
};

/** A lawn mower is the same machine outdoors, with three features of its own. */
export const MOWER_BITS: RobotBits = {
  start: 1,
  pause: 2,
  dock: 4,
  stop: 0,
  locate: 0,
  suction: 0,
  battery: 0,
};

/**
 * What a robot draws where the house is not there to say (`layoutHeight`; one never read): Start, Stop and Dock, its
 * battery and its suction.
 */
export const usual = (bits: RobotBits): number =>
  bits.start | bits.stop | bits.dock | bits.battery | bits.suction;

/**
 * What the house says of a robot: what it does (`supported_features`; its kind's usual where the house has not read
 * it), whether it reports its own battery (`battery_level`), its suction's speeds.
 */
export interface RobotDoes {
  readonly features: number | undefined;
  readonly level: boolean;
  readonly speeds: readonly string[];
}

/**
 * The card's height at a 360 column, for the automatic dashboard's columns: the head; the readouts' row (16 + 44)
 * where the config names a sensor; the battery (a label, the gauge and its marks: 112) where the robot has one; the
 * commands (16 + 44) it takes; its suction as a row of chips under a label — what it does as the house describes it
 * (`house-heights.ts`); where the house is not there to say, every part, and two rows of suction chips.
 */
export function vacuumHeight(config: LovelaceCardConfig, does?: RobotDoes): number {
  if (config['variant'] === 'compact') return COMPACT;
  const id = config['entity'];
  const bits = typeof id === 'string' && id.startsWith('lawn_mower.') ? MOWER_BITS : VACUUM_BITS;
  const features = does?.features ?? usual(bits);
  const has = (key: Command | 'suction' | 'battery'): boolean =>
    bits[key] !== 0 && (features & bits[key]) !== 0;
  const readouts =
    config['area_entity'] || config['duration_entity'] || config['remaining_entity'] ? 60 : 0;
  const battery =
    config['show_battery'] !== false && (config['battery_entity'] || does?.level || has('battery'))
      ? 112
      : 0;
  const commands =
    has('start') || has('pause') || has('stop') || has('dock') || has('locate') ? 60 : 0;
  const style = config['suction_style'] === 'chips' ? 'chips' : 'full';
  const suction = has('suction')
    ? chipBlock(does ? chipRows(does.speeds.map(pretty), style) : 2, style)
    : 0;
  return 64 + readouts + battery + commands + suction + 20;
}

export const VACUUM_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-vacuum-card',
    'Fluvy · Vacuum',
    'Robot vacuum or mower: battery, start · stop · dock · locate, suction, a drive pad.',
    vacuumHeight,
  ],
];
