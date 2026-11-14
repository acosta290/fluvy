// @vitest-environment happy-dom
import { setRoomOrder, type HomeAssistant, type RoomOrder } from '@fluvy/core';
import { DEMO_ROOMS, demoHass, type DemoEntity } from '@fluvy/demo-home';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
// the cards register their heights with core: the strategy lays columns out with them
import { familiesDefined } from '../index.js';
import { generate } from './generate.js';
import { HomeRegistry } from './home-registry.js';
import type { Card, FluvyStrategyConfig, View } from './types.js';

// the families' chunks are fetched as the module loads: they land before the file's environment goes
afterAll(() => familiesDefined);

/*
 * Which room a light or a scene belongs to (#189), on the automatic dashboards: the house's order of its rooms, read
 * by every list by room — with none chosen, the dashboards are 1.20's.
 */

const entity = (
  id: string,
  name: string,
  area?: string,
  attributes: Record<string, unknown> = {},
): DemoEntity => ({
  id,
  state: 'off',
  attributes: { friendly_name: name, ...attributes },
  ...(area ? { registry: { area_id: area } } : {}),
});
const ONOFF = { supported_color_modes: ['onoff'] };

/**
 * The demo home in the reporter's shape: a kitchen of four lights named with it, three scenes there that all begin
 * "Lights", two in the living room named with it, and one in no room. Its rooms, as Home Assistant lists
 * them: the living room and the kitchen downstairs, the bedroom upstairs, the garden on no floor.
 */
const MORE: readonly DemoEntity[] = [
  ...DEMO_ROOMS,
  entity('light.kitchen_island', 'Kitchen Island', 'kitchen', ONOFF),
  entity('light.kitchen_pendant', 'Kitchen Pendant', 'kitchen', ONOFF),
  entity('light.kitchen_counter', 'Counter Kitchen', 'kitchen', ONOFF),
  entity('scene.kitchen_cooking', 'Lights Cooking', 'kitchen'),
  entity('scene.kitchen_dinner', 'Lights Dinner', 'kitchen'),
  entity('scene.kitchen_evening', 'Lights Evening', 'kitchen'),
  entity('scene.living_relax', 'Living room Relax', 'living_room'),
  entity('scene.living_tv', 'Living room TV', 'living_room'),
  entity('scene.good_night', 'Good night'),
];
const house = (more: readonly DemoEntity[] = MORE): HomeAssistant =>
  demoHass({ more }) as unknown as HomeAssistant;

const home = (config: Partial<FluvyStrategyConfig> = {}, hass = house()) =>
  generate({ type: 'custom:fluvy-home', ...config }, hass);
const viewOf = (views: readonly View[], path: string): View =>
  views.find((view) => view.path === path) as View;
const cardsOf = (view: View): Card[] => view.sections.flatMap((section) => section.cards);
const kind = (card: Card): string => card.type.replace('custom:fluvy-', '').replace('-card', '');
/** A view's cards of a kind. */
const ofKind = (view: View, name: string): Card[] =>
  cardsOf(view).filter((card) => kind(card) === name);
describe('the house’s order of its rooms on the automatic dashboards (#189)', () => {
  afterEach(() => setRoomOrder({ sort: 'auto', order: [] }));

  /** The dashboards as a house that orders its rooms so reads them. */
  const under = async (rooms: RoomOrder) => {
    setRoomOrder(rooms);
    const { views } = await home();
    return {
      // the Rooms view: its floors' headings and its rooms' cards, as they stand
      rooms: cardsOf(viewOf(views, 'rooms'))
        .filter((card) => ['heading', 'room'].includes(kind(card)))
        .map((card) => String(card['title'] ?? card['area'])),
      // the Lights view: its groups, by their headings
      lights: ofKind(viewOf(views, 'lights'), 'heading').map((card) => String(card['title'])),
    };
  };

  it('keeps every list as 1.20 sorted it while the house names no order', async () => {
    expect(await under({ sort: 'auto', order: [] })).toEqual({
      // floor by floor, by level, each floor's rooms A to Z; the one on no floor last
      rooms: ['Ground floor', 'kitchen', 'living_room', 'Upstairs', 'bedroom', 'Rooms', 'garden'],
      // the biggest room first
      lights: ['Kitchen', 'Bedroom', 'Living room', 'Outdoor'],
    });
  });

  it('follows Home Assistant’s own order: every list by room, the rooms within their floors', async () => {
    expect(await under({ sort: 'home_assistant', order: [] })).toEqual({
      rooms: ['Ground floor', 'living_room', 'kitchen', 'Upstairs', 'bedroom', 'Rooms', 'garden'],
      // what is in no room last
      lights: ['Living room', 'Kitchen', 'Bedroom', 'Outdoor'],
    });
  });

  it('sorts A to Z', async () => {
    expect(await under({ sort: 'name', order: [] })).toEqual({
      rooms: ['Ground floor', 'kitchen', 'living_room', 'Upstairs', 'bedroom', 'Rooms', 'garden'],
      lights: ['Bedroom', 'Kitchen', 'Living room', 'Outdoor'],
    });
  });

  it('puts the house’s own rooms first, the rest as each list sorts them', async () => {
    expect(await under({ sort: 'auto', order: ['living_room', 'bedroom'] })).toEqual({
      // the floors keep their order: the living room leads its floor
      rooms: ['Ground floor', 'living_room', 'kitchen', 'Upstairs', 'bedroom', 'Rooms', 'garden'],
      lights: ['Living room', 'Bedroom', 'Kitchen', 'Outdoor'],
    });
  });

  it('orders a list split by room, a wall’s rooms and the rooms dashboard’s the same way', async () => {
    const groups = (rooms: RoomOrder): string[] => {
      setRoomOrder(rooms);
      const registry = new HomeRegistry(house());
      return registry.byRoom(registry.lights, () => 'Elsewhere').map(([name]) => name);
    };
    expect(groups({ sort: 'auto', order: [] })).toEqual([
      'Kitchen',
      'Bedroom',
      'Living room',
      'Elsewhere',
    ]);
    expect(groups({ sort: 'name', order: ['living_room'] })).toEqual([
      'Living room',
      'Bedroom',
      'Kitchen',
      'Elsewhere',
    ]);
    const walled = async (rooms: RoomOrder): Promise<string[]> => {
      setRoomOrder(rooms);
      const { views } = await generate({ type: 'custom:fluvy-wall' }, house());
      return ofKind(viewOf(views, 'wall'), 'room').map((card) => String(card['area']));
    };
    expect(await walled({ sort: 'auto', order: [] })).toEqual([
      'kitchen',
      'living_room',
      'bedroom',
      'garden',
    ]);
    expect(await walled({ sort: 'name', order: [] })).toEqual([
      'bedroom',
      'garden',
      'kitchen',
      'living_room',
    ]);
    // the rooms dashboard's tabs are the floors, in Home Assistant's order where the house follows it
    const tabs = async (rooms: RoomOrder): Promise<string[]> => {
      setRoomOrder(rooms);
      const hass = house();
      // Home Assistant lists the upper floor first
      const floors = Object.fromEntries(Object.entries(hass.floors ?? {}).reverse());
      const { views } = await generate({ type: 'custom:fluvy-rooms' }, { ...hass, floors });
      return views.filter((view) => !view.subview).map((view) => view.title);
    };
    expect(await tabs({ sort: 'auto', order: [] })).toEqual([
      'Ground floor',
      'Upstairs',
      'Other rooms',
    ]);
    expect(await tabs({ sort: 'home_assistant', order: [] })).toEqual([
      'Upstairs',
      'Ground floor',
      'Other rooms',
    ]);
  });
});
