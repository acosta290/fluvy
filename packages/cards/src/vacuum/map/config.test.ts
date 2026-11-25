import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { calibrationFor, roomsFor, setupOf, type RobotMap, type Setup } from './config.js';

/*
 * The card's `map` and `presets` as its config writes them (#265): what is read, what is wrong in words, and what
 * the map's own entity adds (its calibration, its rooms), read tolerantly.
 */

const read = (config: { map?: unknown; presets?: unknown }): Setup => {
  const setup = setupOf(config);
  if (typeof setup === 'string') throw new Error(setup);
  return setup;
};
const map = (raw: Record<string, unknown>): RobotMap =>
  read({ map: { image: 'camera.robot_map', ...raw } }).map as RobotMap;

/** A house whose entities say what a map's camera says. */
const house = (states: Record<string, { state?: string; attributes?: object }>): HomeAssistant =>
  ({
    states: Object.fromEntries(
      Object.entries(states).map(([id, { state = 'idle', attributes = {} }]) => [
        id,
        { entity_id: id, state, attributes },
      ]),
    ),
    areas: { hall: { area_id: 'hall', name: 'Hall' } },
  }) as unknown as HomeAssistant;

const POINTS = [
  { vacuum: { x: 25500, y: 25500 }, map: { x: 200, y: 300 } },
  { vacuum: { x: 26500, y: 25500 }, map: { x: 220, y: 300 } },
  { vacuum: { x: 25500, y: 26500 }, map: { x: 200, y: 280 } },
];

describe('a config that names neither', () => {
  it('asks for no map and no preset', () => {
    expect(read({})).toEqual({ presets: [] });
  });
});

describe('the map', () => {
  it('is its picture, with the entity’s own calibration, every control and one time where it says no more', () => {
    expect(map({})).toEqual({
      image: 'camera.robot_map',
      calibration: 'auto',
      modes: ['zone', 'point'],
      names: true,
      repeats: 1,
      own: {},
    });
  });

  it('takes its controls as a subset, in its order', () => {
    expect(map({ controls: ['point', 'names'] })).toMatchObject({ modes: ['point'], names: true });
    expect(map({ controls: ['zone'] })).toMatchObject({ modes: ['zone'], names: false });
    expect(map({ controls: [] })).toMatchObject({ modes: [], names: false });
  });

  it('takes its calibration as the picture’s own, an entity’s, or points written either way', () => {
    expect(map({ calibration: 'image' }).calibration).toBe('image');
    expect(map({ calibration: 'sensor.robot_calibration' }).calibration).toBe(
      'sensor.robot_calibration',
    );
    expect(map({ calibration: POINTS }).calibration).toEqual([
      { map: [200, 300], vacuum: [25500, 25500] },
      { map: [220, 300], vacuum: [26500, 25500] },
      { map: [200, 280], vacuum: [25500, 26500] },
    ]);
    expect(
      map({
        calibration: [
          { vacuum: [0, 0], map: [1, 1] },
          { vacuum: [10, 0], map: [2, 1] },
          { vacuum: [0, 10], map: [1, 2] },
        ],
      }).calibration,
    ).toHaveLength(3);
  });

  it('takes rooms by their id or their area, a Valetudo topic and the person’s own actions', () => {
    const read = map({
      rooms: [
        {
          id: 16,
          name: 'Hall',
          area: 'hall',
          color: 'teal',
          outline: [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
        },
        { area: 'kitchen' },
        { id: 'lounge' },
      ],
      topic: '/valetudo/robot/',
      repeats: 2,
      zone_action: { action: 'perform-action', perform_action: 'script.zone', data: { a: 1 } },
      point_action: { action: 'script.go' },
    });
    expect(read.rooms).toEqual([
      {
        key: '16',
        id: 16,
        area: 'hall',
        name: 'Hall',
        color: 'teal',
        outline: [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
      },
      { key: 'area:kitchen', area: 'kitchen' },
      { key: 'lounge', id: 'lounge' },
    ]);
    expect(read.repeats).toBe(2);
    expect(read.own).toEqual({
      topic: 'valetudo/robot',
      zone_action: { domain: 'script', service: 'zone', data: { a: 1 }, target: [] },
      point_action: { domain: 'script', service: 'go', data: {}, target: [] },
    });
  });

  it.each([
    ['camera.robot_map', '"map" must be a map (image, calibration, rooms)'],
    [{}, '"map.image" is required: a camera, an image entity or a picture’s address'],
    [
      { image: 'x.png', calibration: 'camera' },
      '"map.calibration" must be auto, image, an entity or three or four points',
    ],
    [
      { image: 'x.png', calibration: POINTS.slice(0, 2) },
      '"map.calibration" must be auto, image, an entity or three or four points',
    ],
    [
      { image: 'x.png', calibration: [...POINTS.slice(0, 2), { vacuum: { x: 'a', y: 1 } }] },
      '"map.calibration" must be auto, image, an entity or three or four points',
    ],
    [{ image: 'x.png', rooms: { 16: {} } }, '"map.rooms" must be a list'],
    [{ image: 'x.png', rooms: [16] }, '"map.rooms[0]" must be a room (id, name, outline)'],
    [{ image: 'x.png', rooms: [{ name: 'Hall' }] }, '"map.rooms[0]" needs an id or an area'],
    [
      { image: 'x.png', rooms: [{ id: 1, outline: [[0, 0]] }] },
      '"map.rooms[0].outline" must be three points or more',
    ],
    [
      {
        image: 'x.png',
        rooms: [
          {
            id: 1,
            outline: [
              [0, 0],
              [1, 'b'],
              [2, 2],
            ],
          },
        ],
      },
      '"map.rooms[0].outline" must be points ([x, y])',
    ],
    [
      { image: 'x.png', controls: ['zone', 'rooms'] },
      '"map.controls" must list names, zone and point, or fewer',
    ],
    [{ image: 'x.png', repeats: 4 }, '"map.repeats" must be 1 to 3'],
    [{ image: 'x.png', repeats: 1.5 }, '"map.repeats" must be 1 to 3'],
    [{ image: 'x.png', topic: 'valetudo/+/robot' }, '"map.topic" must be a plain MQTT topic'],
    [{ image: 'x.png', topic: 'valetudo/#' }, '"map.topic" must be a plain MQTT topic'],
    [{ image: 'x.png', topic: 'valetudo\n/robot' }, '"map.topic" must be a plain MQTT topic'],
    [{ image: 'x.png', topic: 7 }, '"map.topic" must be a plain MQTT topic'],
    [{ image: 'x.png', zone_action: 'script.zone' }, '"map.zone_action" must be an action'],
    [
      { image: 'x.png', room_action: { action: 'navigate' } },
      '"map.room_action" needs an action (domain.name)',
    ],
    [
      { image: 'x.png', point_action: { action: 'script.go', data: [1] } },
      '"map.point_action.data" must be a map',
    ],
    [
      { image: 'x.png', point_action: { action: 'script.go', target: { entity_id: 'robot' } } },
      '"map.point_action.target" must name entities',
    ],
  ])('says what is wrong with %j', (raw, fault) => {
    expect(setupOf({ map: raw })).toBe(fault);
  });
});

describe('the presets', () => {
  it('are what each cleans: a zone, zones, rooms, areas or a point, its lesser corner first', () => {
    const { presets } = read({
      presets: [
        { name: 'Kitchen', zone: [26500, 26500, 25500, 25000], color: 'teal', icon: 'mdi:stove' },
        {
          name: 'Both',
          zones: [
            [1, 2, 3, 4],
            [5, 6, 7, 8],
          ],
          repeats: 2,
          on_map: false,
        },
        { name: 'Rooms', rooms: [16, '17'], confirmation: true },
        { name: 'Areas', areas: ['kitchen'] },
        { name: 'Dock side', point: [25500, 26000] },
        { name: 'Full clean' },
      ],
    });
    expect(presets).toEqual([
      {
        name: 'Kitchen',
        icon: 'mdi:stove',
        color: 'teal',
        zones: [[25500, 25000, 26500, 26500]],
        rooms: [],
        areas: [],
        repeats: 1,
        onMap: true,
      },
      {
        name: 'Both',
        zones: [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
        ],
        rooms: [],
        areas: [],
        repeats: 2,
        onMap: false,
      },
      {
        name: 'Rooms',
        zones: [],
        rooms: [16, '17'],
        areas: [],
        repeats: 1,
        confirmation: true,
        onMap: true,
      },
      { name: 'Areas', zones: [], rooms: [], areas: ['kitchen'], repeats: 1, onMap: true },
      {
        name: 'Dock side',
        zones: [],
        rooms: [],
        areas: [],
        point: [25500, 26000],
        repeats: 1,
        onMap: true,
      },
      { name: 'Full clean', zones: [], rooms: [], areas: [], repeats: 1, onMap: true },
    ]);
  });

  it('answers of the person’s own: a call is checked, an action of another kind is kept as written', () => {
    const { presets } = read({
      presets: [
        {
          name: 'Table',
          tap_action: {
            action: 'perform-action',
            perform_action: 'vacuum.send_command',
            data: { command: 'app_zoned_clean', params: '[[selection]]' },
            confirmation: { text: 'Sure?' },
          },
        },
        {
          name: 'Cameras',
          tap_action: { action: 'navigate', navigation_path: '/cameras' },
          hold_action: { action: 'none' },
          double_tap_action: { action: 'perform-action', perform_action: 'script.twice' },
        },
      ],
    });
    expect(presets).toMatchObject([
      {
        name: 'Table',
        tap: {
          confirmation: { text: 'Sure?' },
          call: {
            domain: 'vacuum',
            service: 'send_command',
            data: { command: 'app_zoned_clean', params: '[[selection]]' },
            target: [],
          },
        },
      },
      {
        name: 'Cameras',
        tap: { action: { action: 'navigate', navigation_path: '/cameras' } },
        hold: { action: { action: 'none' } },
        double: { call: { domain: 'script', service: 'twice', data: {}, target: [] } },
      },
    ]);
    expect(presets[0]).not.toHaveProperty('hold');
  });

  it('`areas` asks for the house’s own', () => {
    expect(read({ presets: 'areas' }).presets).toBe('areas');
  });

  it.each([
    ['rooms', '"presets" must be a list, or the word areas'],
    [[16], '"presets[0]" must be a preset (name, zone, rooms…)'],
    [[{ zone: [1, 2, 3, 4] }], '"presets[0].name" is required'],
    [[{ name: 'A' }, { name: 'B', zone: [1, 2, 3] }], '"presets[1].zone" must be four numbers'],
    [[{ name: 'A', zone: [1, 2, 3, '4'] }], '"presets[0].zone" must be four numbers'],
    [
      [{ name: 'A', zones: [1, 2, 3, 4] }],
      '"presets[0].zones" must be a list of four numbers each',
    ],
    [[{ name: 'A', rooms: 16 }], '"presets[0].rooms" must be a list of room ids'],
    [[{ name: 'A', rooms: [{}] }], '"presets[0].rooms" must be a list of room ids'],
    [[{ name: 'A', areas: 'kitchen' }], '"presets[0].areas" must be a list of areas'],
    [[{ name: 'A', point: [1] }], '"presets[0].point" must be two numbers'],
    [[{ name: 'A', repeats: 0 }], '"presets[0].repeats" must be 1 to 3'],
    [[{ name: 'A', tap_action: 'script.x' }], '"presets[0].tap_action" must be an action'],
    [
      [{ name: 'A', tap_action: { action: 'perform-action', perform_action: 'nothing' } }],
      '"presets[0].tap_action" needs an action (domain.name)',
    ],
    [[{ name: 'A', hold_action: 7 }], '"presets[0].hold_action" must be an action'],
    [
      [{ name: 'A', double_tap_action: { action: 'call-service', service: 'x' } }],
      '"presets[0].double_tap_action" needs an action (domain.name)',
    ],
  ])('says what is wrong with %j', (raw, fault) => {
    expect(setupOf({ presets: raw })).toBe(fault);
  });
});

describe('the calibration', () => {
  it('is the picture’s own measure for a floor plan', () => {
    expect(calibrationFor(undefined, map({ calibration: 'image' }))?.toRobot([120, 80])).toEqual([
      120, 80,
    ]);
  });

  it('is the points the config writes', () => {
    const [x = 0, y = 0] =
      calibrationFor(undefined, map({ calibration: POINTS }))?.toMap([26500, 26500]) ?? [];
    expect([Math.round(x), Math.round(y)]).toEqual([220, 280]);
  });

  it('is the map entity’s own where the config says auto, or nothing', () => {
    const hass = house({ 'camera.robot_map': { attributes: { calibration_points: POINTS } } });
    const [x = 0, y = 0] = calibrationFor(hass, map({}))?.toMap([26500, 26500]) ?? [];
    expect([Math.round(x), Math.round(y)]).toEqual([220, 280]);
  });

  it('is another entity’s, in its attribute or in its state as JSON', () => {
    const hass = house({
      'sensor.in_attribute': { attributes: { calibration_points: POINTS } },
      'sensor.in_state': { state: JSON.stringify(POINTS) },
    });
    for (const id of ['sensor.in_attribute', 'sensor.in_state'])
      expect(calibrationFor(hass, map({ calibration: id }))).toBeDefined();
  });

  it('is none where nothing can be read: a map not calibrated, never a fault', () => {
    expect(calibrationFor(house({}), map({}))).toBeUndefined();
    expect(calibrationFor(undefined, map({}))).toBeUndefined();
    expect(
      calibrationFor(
        house({ 'sensor.gone': { state: 'unavailable' } }),
        map({ calibration: 'sensor.gone' }),
      ),
    ).toBeUndefined();
    expect(
      calibrationFor(
        house({ 'camera.robot_map': { attributes: { calibration_points: 'not json [' } } }),
        map({}),
      ),
    ).toBeUndefined();
    // a plain address holds no calibration of its own
    expect(
      calibrationFor(house({}), read({ map: { image: '/local/floor.png' } }).map as RobotMap),
    ).toBeUndefined();
    // three points on one line
    expect(
      calibrationFor(
        undefined,
        map({
          calibration: [
            { vacuum: [0, 0], map: [0, 0] },
            { vacuum: [1, 1], map: [1, 1] },
            { vacuum: [2, 2], map: [2, 2] },
          ],
        }),
      ),
    ).toBeUndefined();
  });
});

describe('the rooms', () => {
  it('are the map entity’s own where the config lists none: a box each, as Xiaomi Cloud Map Extractor says them', () => {
    const hass = house({
      'camera.robot_map': {
        attributes: {
          rooms: {
            16: { x0: 24000, y0: 25000, x1: 26000, y1: 27000, name: 'Hall' },
            17: { x0: 26000, y0: 25000, x1: 28000, y1: 27000 },
          },
        },
      },
    });
    expect(roomsFor(hass, map({}))).toEqual([
      {
        key: '16',
        id: 16,
        name: 'Hall',
        outline: [
          [24000, 25000],
          [26000, 25000],
          [26000, 27000],
          [24000, 27000],
        ],
      },
      {
        key: '17',
        id: 17,
        name: '17',
        outline: [
          [26000, 25000],
          [28000, 25000],
          [28000, 27000],
          [26000, 27000],
        ],
      },
    ]);
  });

  it('take an outline where the entity says one, a name of the person’s own before the robot’s, a list as a map', () => {
    const hass = house({
      'camera.robot_map': {
        attributes: {
          rooms: [
            {
              number: 3,
              name: 'Room 3',
              custom_name: 'Study',
              outline: [
                [0, 0],
                [50, 0],
                [50, 40],
                [20, 60],
              ],
              x: 25,
              y: 25,
            },
            { id: 4, name: 'Bath' },
          ],
        },
      },
    });
    expect(roomsFor(hass, map({}))).toEqual([
      {
        key: '3',
        id: 3,
        name: 'Study',
        outline: [
          [0, 0],
          [50, 0],
          [50, 40],
          [20, 60],
        ],
      },
      { key: '4', id: 4, name: 'Bath', outline: [] },
    ]);
  });

  it('take nothing the house writes but numbers for a room’s id', () => {
    const hass = house({
      'camera.robot_map': {
        attributes: {
          rooms: {
            'kitchen"; drop': { x0: 0, y0: 0, x1: 1, y1: 1 },
            '1.5': { x0: 0, y0: 0, x1: 1, y1: 1 },
            '': { x0: 0, y0: 0, x1: 1, y1: 1 },
            7: 'a room',
          },
        },
      },
    });
    expect(roomsFor(hass, map({}))).toEqual([]);
    expect(
      roomsFor(house({ 'camera.robot_map': { attributes: { rooms: 'x' } } }), map({})),
    ).toEqual([]);
    expect(roomsFor(undefined, map({}))).toEqual([]);
  });

  it('are those the config lists, in its order, each completed by what the entity says of the same id', () => {
    const hass = house({
      'camera.robot_map': {
        attributes: {
          rooms: {
            16: { x0: 0, y0: 0, x1: 10, y1: 10, name: 'Corridor' },
            17: { x0: 10, y0: 0, x1: 20, y1: 10, name: 'Kitchen' },
            18: { x0: 20, y0: 0, x1: 30, y1: 10, name: 'Bath' },
          },
        },
      },
    });
    const rooms = roomsFor(
      hass,
      map({ rooms: [{ id: 17 }, { id: 16, name: 'Hall', area: 'hall' }, { area: 'hall' }] }),
    );
    expect(rooms.map((room) => [room.key, room.name, room.outline.length, room.area])).toEqual([
      ['17', 'Kitchen', 4, undefined],
      ['16', 'Hall', 4, 'hall'],
      // a room known by its area alone takes the area's name, and has no outline to draw
      ['area:hall', 'Hall', 0, 'hall'],
    ]);
  });
});
