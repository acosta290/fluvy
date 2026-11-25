import type { Point, Rect } from './calibration.js';
import type { Job } from './calls.js';
import type { Preset, Room } from './config.js';

/*
 * What is picked on a map (#265), one kind at a time: rooms, by their keys; zones, the presets' saved ones by their
 * place in the list and one marked by hand; or a point to go to, a hand's or a preset's. Picking another kind starts
 * over. It holds no element: the card keeps it, the map draws it and says what a hand changed.
 */
export type Selection =
  | { readonly kind: 'rooms'; readonly rooms: readonly string[] }
  | { readonly kind: 'zones'; readonly presets: readonly number[]; readonly drawn?: Rect }
  | { readonly kind: 'point'; readonly point: Point; readonly preset?: number };

/** A list with `item` in it where it was not, out of it where it was. */
const toggled = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((other) => other !== item) : [...list, item];

/** A room tapped: in the selection, or out of it; nothing where it was the last. */
export function withRoom(chosen: Selection | undefined, key: string): Selection | undefined {
  const rooms = toggled(chosen?.kind === 'rooms' ? chosen.rooms : [], key);
  return rooms.length ? { kind: 'rooms', rooms } : undefined;
}

/** A saved zone tapped (its preset's place in the list): in the selection, or out of it. */
export function withZone(chosen: Selection | undefined, index: number): Selection | undefined {
  const zones = chosen?.kind === 'zones' ? chosen : undefined;
  const presets = toggled(zones?.presets ?? [], index);
  const drawn = zones?.drawn;
  return presets.length || drawn
    ? { kind: 'zones', presets, ...(drawn ? { drawn } : {}) }
    : undefined;
}

/** A zone marked by hand: with the saved zones picked, in the place of the one marked before. */
export const withDrawn = (chosen: Selection | undefined, drawn: Rect): Selection => ({
  kind: 'zones',
  presets: chosen?.kind === 'zones' ? chosen.presets : [],
  drawn,
});

/** A point to go to: a hand's, or a preset's. */
export const withPoint = (point: Point, preset?: number): Selection => ({
  kind: 'point',
  point,
  ...(preset === undefined ? {} : { preset }),
});

/** The rooms of the map a preset names, by their ids or by their areas. */
const namedBy = (preset: Preset, rooms: readonly Room[]): string[] =>
  rooms
    .filter(
      (room) =>
        (room.id !== undefined && preset.rooms.some((id) => String(id) === String(room.id))) ||
        (room.area !== undefined && preset.areas.includes(room.area)),
    )
    .map((room) => room.key);

/** Whether a preset can be shown on the map: it asks to be, and has a zone, a point or rooms the map draws. */
export const showable = (preset: Preset, rooms: readonly Room[]): boolean =>
  preset.onMap &&
  (preset.zones.length > 0 || preset.point !== undefined || namedBy(preset, rooms).length > 0);

/** Whether the selection shows a preset whole: its zones, its point, or every room it names. */
export function shows(
  chosen: Selection | undefined,
  preset: Preset,
  index: number,
  rooms: readonly Room[],
): boolean {
  if (chosen?.kind === 'zones') return chosen.presets.includes(index);
  if (chosen?.kind === 'point') return chosen.preset === index;
  const named = namedBy(preset, rooms);
  return (
    chosen !== undefined && named.length > 0 && named.every((key) => chosen.rooms.includes(key))
  );
}

/**
 * A preset shown on the map, or taken off it (its chip held): its zones among the zones, its point as the point, the
 * rooms it names among the rooms, all of them at once.
 */
export function withPreset(
  chosen: Selection | undefined,
  preset: Preset,
  index: number,
  rooms: readonly Room[],
): Selection | undefined {
  if (preset.zones.length) return withZone(chosen, index);
  if (preset.point)
    return shows(chosen, preset, index, rooms) ? undefined : withPoint(preset.point, index);
  const named = namedBy(preset, rooms);
  const held = chosen?.kind === 'rooms' ? chosen.rooms : [];
  const next = shows(chosen, preset, index, rooms)
    ? held.filter((key) => !named.includes(key))
    : [...new Set([...held, ...named])];
  return next.length ? { kind: 'rooms', rooms: next } : undefined;
}

/** The names of what is picked, in the order it was: rooms', presets'; none for what a hand marked. */
export function namesOf(
  chosen: Selection,
  rooms: readonly Room[],
  presets: readonly Preset[],
): string[] {
  if (chosen.kind === 'rooms')
    return chosen.rooms.flatMap((key) => rooms.find((room) => room.key === key)?.name ?? []);
  if (chosen.kind === 'zones') return chosen.presets.flatMap((index) => presets[index]?.name || []);
  return chosen.preset === undefined
    ? []
    : ([presets[chosen.preset]?.name].filter(Boolean) as string[]);
}

/** What a preset asks of the robot: its zones, its rooms, its areas or its point, its own times over. */
export const presetJob = (preset: Preset): Job => ({
  ...(preset.zones.length ? { zones: preset.zones } : {}),
  ...(preset.rooms.length ? { rooms: preset.rooms } : {}),
  ...(preset.areas.length ? { areas: preset.areas } : {}),
  ...(preset.point ? { point: preset.point } : {}),
  repeats: preset.repeats,
});

/**
 * What a selection asks of the robot: its rooms by their ids where every one has one, and by their areas where every
 * one names one; its zones, the saved ones and the one marked; or its point. A saved zone is cleaned as many times as
 * its preset says, the most of those picked, never fewer than the map's own `repeats`.
 */
export function jobOf(
  chosen: Selection,
  rooms: readonly Room[],
  presets: readonly Preset[],
  repeats: number,
): Job {
  if (chosen.kind === 'point') return { point: chosen.point, repeats };
  if (chosen.kind === 'zones') {
    const picked = chosen.presets.flatMap((index) => presets[index] ?? []);
    return {
      zones: [...picked.flatMap((preset) => preset.zones), ...(chosen.drawn ? [chosen.drawn] : [])],
      repeats: Math.max(repeats, ...picked.map((preset) => preset.repeats)),
    };
  }
  const picked = chosen.rooms.flatMap((key) => rooms.find((room) => room.key === key) ?? []);
  const ids = picked.flatMap((room) => room.id ?? []);
  const areas = picked.flatMap((room) => room.area ?? []);
  return {
    ...(ids.length === picked.length ? { rooms: ids } : {}),
    ...(areas.length === picked.length ? { areas } : {}),
    repeats,
  };
}
