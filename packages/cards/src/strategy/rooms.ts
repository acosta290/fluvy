import {
  areaClimate,
  areaContents,
  climateAttribute,
  holdsSomething,
  type AreaRegistryEntry,
} from '@fluvy/core';
import { applianceSections } from './appliances.js';
import { capped, moreAfter } from './caps.js';
import type { HomeRegistry } from './home-registry.js';
import {
  applianceTile,
  flowed,
  full,
  headed,
  heading,
  lightGroups,
  readoutsCards,
  section,
  sizedTile,
  thermostat,
  tileRows,
  when,
} from './layout.js';
import type { Card, Section, StrategyContext, View } from './types.js';

/*
 * The rooms: a view of every room of the house (its card, grouped by floor when there are floors), and a subview
 * per room with what it holds — its thermostat, lights, covers, media, plugs, readings and camera, and its appliances
 * across under them.
 */

/** The areas a dashboard shows: those with something to show, by the room card's own rule, floor by floor. */
export function roomsOf(home: HomeRegistry): AreaRegistryEntry[] {
  return home.areas.filter((area) => holdsSomething(areaContents(home.registries, area.area_id)));
}

const roomPath = (base: string, area: AreaRegistryEntry): string => `${base}/room-${area.area_id}`;

export const roomCard = (ctx: StrategyContext, area: AreaRegistryEntry): Card => ({
  type: 'custom:fluvy-room-card',
  area: area.area_id,
  path: roomPath(ctx.base, area),
  ...(ctx.style.room ? { variant: ctx.style.room } : {}),
  grid_options: { columns: 12 },
});

/** The Rooms view: a card a room; headed by floor when the house has more than one. */
export function roomsView(ctx: StrategyContext): Section[] {
  const { home, t, base } = ctx;
  const rooms = roomsOf(home);
  const floors = home.floors.filter((floor) =>
    rooms.some((room) => room.floor_id === floor.floor_id),
  );
  if (floors.length < 2)
    return flowed(
      ctx,
      rooms.map((area) => [roomCard(ctx, area)]),
    );
  const unplaced = rooms.filter(
    (room) => !floors.some((floor) => floor.floor_id === room.floor_id),
  );
  return flowed(ctx, [
    ...floors
      .map((floor) =>
        headed(
          heading(floor.name, floor.icon ?? 'fluvy:home', [], `${base}/rooms`),
          rooms
            .filter((room) => room.floor_id === floor.floor_id)
            .map((area) => [roomCard(ctx, area)]),
        ),
      )
      .flat(),
    ...(unplaced.length
      ? headed(
          heading(t('strategy.rooms'), 'fluvy:home', [], `${base}/rooms`),
          unplaced.map((area) => [roomCard(ctx, area)]),
        )
      : []),
  ]);
}

/** Where a room's heading leads back to, and what it says ("All rooms", or the wall's home). */
export interface RoomBack {
  readonly path: string;
  readonly title: string;
}

/**
 * One room: what it holds, in the home view's reading order, under a way back to where it was opened from; each list at
 * the house's cap, with its "N more" row.
 */
export function roomSections(
  ctx: StrategyContext,
  area: AreaRegistryEntry,
  back: RoomBack,
  columns = 3,
): Section[] {
  const { home, t } = ctx;
  const inRoom = (ids: readonly string[]): string[] =>
    ids.filter((id) => home.areaOf(id) === area.area_id);
  const climate = inRoom(home.climate);
  const players = inRoom(home.players);
  const cameras = inRoom(home.cameras);
  const found = areaClimate(home.registries, area.area_id);
  // the room's own readings, else the sensors its area names (a thermostat's or an appliance's reading is its card's)
  const named = (['temperature', 'humidity'] as const).flatMap((kind) => {
    const id = found[kind];
    return id && !climateAttribute(id, kind) && !home.ofAppliance(id) ? [id] : [];
  });
  const sensed = inRoom([...home.temperatures, ...home.humidities]);
  const coverTiles = (ids: readonly string[]): Card =>
    full('tiles', {
      size: 'compact',
      columns: 2,
      tiles: ids.map((id) => ({ entity: id, ...home.named(id) })),
    });
  const lights = capped(
    ctx,
    { key: 'lights', title: 'strategy.lights', icon: 'fluvy:bulb' },
    inRoom(home.lights),
    (ids) => lightGroups(ctx, ids),
  );
  const covers = capped(
    ctx,
    { key: 'covers', title: 'strategy.covers', icon: 'fluvy:blinds' },
    inRoom(home.covers),
    (ids) => [[coverTiles(ids)]],
  );
  const plugs = capped(
    ctx,
    { key: 'appliances', title: 'strategy.appliances', icon: 'fluvy:plug' },
    inRoom(home.applianceTiles),
    (ids) => tileRows(ids.map((id) => applianceTile(home, id))),
  );
  const readings = capped(
    ctx,
    { key: 'readings', title: 'strategy.readings', icon: 'fluvy:thermo' },
    sensed.length ? sensed : named,
    (ids) => readoutsCards(home, ids).map((card) => [card]),
  );
  const sections = flowed(
    ctx,
    [
      [heading(back.title, 'fluvy:home', [], back.path)],
      ...(climate[0] ? [[thermostat(climate[0], ctx.style)]] : []),
      ...when(lights.shown.length, () =>
        moreAfter(
          headed(
            heading(t('strategy.lights'), 'fluvy:bulb', inRoom(home.lights)),
            tileRows(lights.shown.map((id) => sizedTile(id, home.named(id), ctx.style))),
          ),
          lights,
        ),
      ),
      ...when(covers.shown.length, () =>
        moreAfter(
          [
            [
              heading(t('strategy.covers'), 'fluvy:blinds', inRoom(home.covers)),
              coverTiles(covers.shown),
            ],
          ],
          covers,
        ),
      ),
      ...(players.length
        ? [[full('media', { entity: players[0], ...home.named(players[0] ?? '') })]]
        : []),
      ...when(plugs.shown.length, () =>
        moreAfter(
          headed(
            heading(t('strategy.appliances'), 'fluvy:plug', inRoom(home.applianceTiles)),
            tileRows(plugs.shown.map((id) => applianceTile(home, id))),
          ),
          plugs,
        ),
      ),
      ...moreAfter(
        readoutsCards(home, readings.shown).map((card) => [card]),
        readings,
      ),
      ...(cameras.length ? [[full('camera', { entity: cameras[0] })]] : []),
    ],
    [],
    columns,
  );
  const devices = home.applianceDevices.filter(
    (device) => home.deviceArea(device) === area.area_id,
  );
  return [
    ...(sections.length ? sections : [section(heading(back.title, 'fluvy:home', [], back.path))]),
    ...applianceSections(ctx, devices, columns),
  ];
}

/** The subview of a room. */
export function roomView(
  ctx: StrategyContext,
  area: AreaRegistryEntry,
  columns: number,
  back: RoomBack,
): View {
  return {
    title: area.name,
    icon: area.icon ?? 'fluvy:home',
    path: `room-${area.area_id}`,
    type: 'sections',
    max_columns: columns,
    subview: true,
    back_path: back.path,
    sections: roomSections(ctx, area, back, columns),
  };
}
