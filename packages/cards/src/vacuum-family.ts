import type { LovelaceCardConfig } from '@fluvy/core';
import { cameraRatio, plateHeight } from './devices-family.js';
import type { FamilyEntry } from './energy-family.js';
import { headlessOf, muted } from './shared/head-lines.js';
import { CHIP_GLYPH, chipBlock, chipRows, COLUMN, COMPACT } from './shared/heights.js';
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

type Bag = Readonly<Record<string, unknown>>;
const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The map a config asks for (`map`: a block of its own, #265), unless it hides it (`show_map`). */
export const mapOf = (config: LovelaceCardConfig): Bag | undefined =>
  config['show_map'] !== false && isBag(config['map']) ? config['map'] : undefined;

/**
 * A map's plate in a column: its shape (`aspect_ratio`: one of the camera's named ones or `w:h`, 4:3 where it says
 * none) across it, on the 4 grid; never the picture's own shape, which only its first frame would say.
 */
export function mapPlate(map: Bag, width = COLUMN): number {
  const asked = map['aspect_ratio'];
  return plateHeight(width, cameraRatio(asked === undefined || asked === 'native' ? '4:3' : asked));
}

/**
 * The rows the presets' chips take at `width` (`presets`, unless hidden by `show_presets`): laid out by their names
 * as the config writes them, and the glyph of each that has an icon; one row where they are the house's areas
 * (`presets: areas`), which only the house knows.
 */
export function presetRows(config: LovelaceCardConfig, width = COLUMN): number {
  const presets: unknown = config['presets'];
  if (config['show_presets'] === false) return 0;
  if (presets === 'areas') return 1;
  const named = Array.isArray(presets) ? presets.filter(isBag) : [];
  return chipRows(
    named.map((preset) => String(preset['name'] ?? '')),
    config['presets_style'] === 'chips' ? 'chips' : 'full',
    width,
    undefined,
    named.map((preset) => (preset['icon'] ? CHIP_GLYPH : 0)),
  );
}

/** The presets' chips under what precedes them: 16, then their rows of 44 (content-sized ones 8 apart). */
export const presetsBlock = (rows: number, style?: unknown): number =>
  rows ? 16 + rows * 44 + (style === 'chips' ? (rows - 1) * 8 : 0) : 0;

/**
 * What a card's map and its presets add to it (#265): the map's plate 16 under the head, the presets' chips; from the
 * config alone, whatever the map shows.
 */
function extrasHeight(config: LovelaceCardConfig): number {
  const map = mapOf(config);
  return (map ? 16 + mapPlate(map) : 0) + presetsBlock(presetRows(config), config['presets_style']);
}

/**
 * The card's height at a 360 column, for the automatic dashboard's columns: the head; the readouts' row (16 + 44)
 * where the config names a sensor; the battery (a label, the gauge and its marks: 112) where the robot has one; the
 * commands (16 + 44) it takes; its suction as a row of chips under a label — what it does as the house describes it
 * (`house-heights.ts`); where the house is not there to say, every part, and two rows of suction chips. Its map and
 * its presets where its config asks for them (`extrasHeight`), its suction unless it hides it
 * (`show_suction`); the compact card draws none of them. A head left with nothing in it goes, with the 16 under it
 * (#259).
 */
export function vacuumHeight(config: LovelaceCardConfig, does?: RobotDoes): number {
  const head = headlessOf(config, muted(config), 16);
  if (config['variant'] === 'compact') return COMPACT - head;
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
  const suction =
    config['show_suction'] !== false && has('suction')
      ? chipBlock(does ? chipRows(does.speeds.map(pretty), style) : 2, style)
      : 0;
  return 64 - head + extrasHeight(config) + readouts + battery + commands + suction + 20;
}

export const VACUUM_FAMILY: readonly FamilyEntry[] = [['fluvy-vacuum-card', vacuumHeight]];
