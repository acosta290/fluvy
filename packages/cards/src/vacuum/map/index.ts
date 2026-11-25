// the map's words first: every module of this chunk says them
import './english.js';
import './map-view.js';
import type { HomeAssistant } from '@fluvy/core';
import type { Choice } from '../../shared/chips.js';
import { waysOf } from './calls.js';
import { calibrationFor, roomsFor, type Answer, type Setup } from './config.js';
import type { Scene } from './map-view.js';
import { areaPresets, presetCall, presetChips, runPreset } from './presets.js';
import { jobOf, showable, shows, withPreset, type Selection } from './selection.js';

/*
 * The Vacuum card's map and its presets (#265): a chunk of its own, fetched by the first card whose config names
 * either, so a card that names neither carries nothing of them. The card reads its config with `setupOf`, draws
 * `<fluvy-vacuum-map>` with the scene `sceneOf` makes of it and the house, and its presets as the chips `chipsOf`
 * says, each run by `tapPreset`.
 */

export { setupOf, type Setup } from './config.js';
export {
  MAP_CHOSEN,
  type MapChosenDetail,
  type MapHeld,
  type MapHost,
  type Scene,
} from './map-view.js';
export type { Selection } from './selection.js';

/**
 * What the card draws of its map and its presets, as its config and the house say now: the presets (those written,
 * or one for each area the robot has mapped: `read` is told when the house has said them), the map's rooms and its
 * calibration, and the robot's ways.
 */
export function sceneOf(
  hass: HomeAssistant | undefined,
  entity: string,
  setup: Setup,
  read: () => void,
): Scene {
  const { map } = setup;
  return {
    entity,
    presets: setup.presets === 'areas' ? areaPresets(hass, entity, read) : setup.presets,
    rooms: map ? roomsFor(hass, map) : [],
    ways: waysOf(hass, entity, map?.own),
    ...(map ? { map, calibration: calibrationFor(hass, map) } : {}),
  };
}

/** The colours a scene names (its rooms', its presets'): what the card derives before the map wears them. */
export const coloursOf = (scene: Scene): readonly string[] =>
  [...scene.rooms, ...scene.presets].flatMap((item) => item.color ?? []);

/** What the selection asks of the robot, for a preset whose own call takes its numbers from the map. */
const pickedJob = (scene: Scene, chosen: Selection | undefined) =>
  chosen ? jobOf(chosen, scene.rooms, scene.presets, scene.map?.repeats ?? 1) : undefined;

/**
 * A preset's chip answers: a tap runs it; a still press or a double tap runs what the person wrote for it, and
 * nothing where they wrote none. Asked first where it says so.
 */
export function runChip(
  node: HTMLElement,
  hass: HomeAssistant,
  scene: Scene,
  chosen: Selection | undefined,
  key: string,
  answer: Answer = 'tap',
): void {
  const preset = scene.presets[Number(key)];
  const own = preset?.[answer];
  if (!preset || (answer !== 'tap' && !own)) return;
  const found = presetCall(hass, scene.ways, scene.entity, preset, pickedJob(scene, chosen), own);
  runPreset(node, hass, scene.entity, preset, found, own);
}

/** Whether a preset's chip answers a double tap: its tap then waits to see whether a second follows. */
export const doubles = (scene: Scene, key: string): boolean =>
  scene.presets[Number(key)]?.double !== undefined;

/** What the card says of its presets' chips: its colours, whether its robot is out of reach, where a hold is kept. */
export interface ChipsHost {
  readonly node: HTMLElement;
  readonly accent: (colour: string | undefined) => string | undefined;
  readonly still: boolean;
  readonly pick: (chosen: Selection | undefined) => void;
}

/**
 * The presets as chips: lit while the map shows one whole, still where the robot has no way for one (or its own
 * call waits for something picked on the map); a still press runs what the person wrote for it, else shows the
 * preset on the map where the map draws it.
 */
export function chipsOf(
  hass: HomeAssistant,
  scene: Scene,
  chosen: Selection | undefined,
  host: ChipsHost,
): Choice[] {
  const picked = pickedJob(scene, chosen);
  const mapped = scene.map !== undefined && scene.calibration !== undefined;
  return presetChips(scene.presets, {
    accent: host.accent,
    still: host.still,
    shown: (preset, index) =>
      mapped && showable(preset, scene.rooms) && shows(chosen, preset, index, scene.rooms),
    runs: (preset) =>
      preset.tap?.action !== undefined ||
      presetCall(hass, scene.ways, scene.entity, preset, picked) !== undefined,
    hold: (preset, index) =>
      preset.hold
        ? () => runChip(host.node, hass, scene, chosen, String(index), 'hold')
        : mapped && showable(preset, scene.rooms)
          ? () => host.pick(withPreset(chosen, preset, index, scene.rooms))
          : undefined,
  });
}
