// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import { visibleFields } from '../shared/form.js';
import { vacuumHeight } from '../vacuum-family.js';
import type { FluvyVacuumMap } from './map/map-view.js';
import { getConfigForm, lists } from './vacuum-editor.js';

// the Vacuum card's family lands with the index: its tag is defined before a card is made
await familiesDefined;

/*
 * The Vacuum card's map and presets (#265) on the card itself: what they add to its height, where each stands, that
 * a card that names neither carries neither, what a preset's chip and the map's own bar send, what is wrong with a
 * config said in words, and what the editor shows.
 */

const STAMP = '2026-11-25T08:00:00Z';
/* PAUSE 4 · STOP 8 · RETURN_HOME 16 · FAN_SPEED 32 · BATTERY 64 · LOCATE 512 · START 8192 */
const FEATURES = 4 + 8 + 16 + 32 + 64 + 512 + 8192;
const ROBOT = 'vacuum.robot';

const CALIBRATION = [
  { vacuum: { x: 0, y: 0 }, map: { x: 0, y: 0 } },
  { vacuum: { x: 1000, y: 0 }, map: { x: 100, y: 0 } },
  { vacuum: { x: 0, y: 1000 }, map: { x: 0, y: 100 } },
];
const ROOMS = [
  {
    id: 16,
    name: 'Hall',
    outline: [
      [0, 0],
      [1000, 0],
      [1000, 1000],
      [0, 1000],
    ],
  },
  {
    id: 17,
    name: 'Kitchen',
    outline: [
      [1000, 0],
      [3000, 0],
      [3000, 1000],
      [1000, 1000],
    ],
  },
];
const MAP = { image: 'camera.robot_map', rooms: ROOMS };

interface Call {
  readonly action: string;
  readonly data: unknown;
  readonly target: unknown;
}

/** A house with a Xiaomi Miio robot in `state`, its map's camera, and the calls made of it. */
function house(state = 'docked') {
  const calls: Call[] = [];
  const entity = (id: string, at: string, attributes: Record<string, unknown>) => ({
    entity_id: id,
    state: at,
    attributes,
    last_changed: STAMP,
    last_updated: STAMP,
  });
  const targeted = (...names: string[]) =>
    Object.fromEntries(names.map((name) => [name, { target: {} }]));
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C', length: 'km' } },
    states: {
      [ROBOT]: entity(ROBOT, state, {
        friendly_name: 'Robot',
        supported_features: FEATURES,
        battery_level: 80,
        fan_speed: 'quiet',
        fan_speed_list: ['quiet', 'max'],
      }),
      'camera.robot_map': entity('camera.robot_map', 'idle', {
        friendly_name: 'Map',
        entity_picture: '/api/camera_proxy/camera.robot_map?token=t',
        calibration_points: CALIBRATION,
      }),
    },
    entities: { [ROBOT]: { entity_id: ROBOT, platform: 'xiaomi_miio' } },
    devices: {},
    areas: {},
    services: {
      vacuum: targeted('start', 'send_command'),
      xiaomi_miio: targeted('vacuum_clean_zone', 'vacuum_clean_segment', 'vacuum_goto'),
    },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: (domain: string, service: string, data: unknown, target: unknown) => {
      calls.push({ action: `${domain}.${service}`, data, target });
      return Promise.resolve();
    },
  } as unknown as HomeAssistant;
  return { hass, calls };
}

type CardElement = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

function make(config: Record<string, unknown>): CardElement {
  const card = document.createElement('fluvy-vacuum-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-vacuum-card', entity: ROBOT, ...config });
  return card;
}

/** A card drawn, its map's chunk landed and what it reads of the config drawn too. */
async function draw(hass: HomeAssistant, config: Record<string, unknown>, width = 360) {
  const card = make(config);
  card.hass = hass;
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  if (config['map'] !== undefined || config['presets'] !== undefined) {
    await vi.waitFor(() => expect(customElements.get('fluvy-vacuum-map')).toBeDefined());
    await card.updateComplete;
    await card.updateComplete;
  }
  return card;
}

const root = (card: CardElement): ShadowRoot => card.shadowRoot!;
const mapOf = (card: CardElement) => root(card).querySelector<FluvyVacuumMap>('fluvy-vacuum-map');
const chips = (card: CardElement): HTMLButtonElement[] => [
  ...root(card).querySelectorAll<HTMLButtonElement>('.vc-presets .fv-chip'),
];
/** The card's parts in their order, each by what it is. */
const parts = (card: CardElement): string[] =>
  [...root(card).querySelector('article')!.children].map((part) =>
    part.localName === 'div' ? `.${part.classList[0]}` : part.localName,
  );

/** The map as a browser that has its picture draws it: the picture's own size said, and its shapes drawn. */
async function pictured(card: CardElement): Promise<FluvyVacuumMap> {
  const map = mapOf(card)!;
  map.natural_ = [300, 100];
  await map.updateComplete;
  return map;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('a config whose map is wrong', () => {
  // the first case of the file: the map's chunk is not here yet, and lands with it
  it('is built again once its chunk is here, and then says what is wrong, as every card does', async () => {
    const card = make({ map: { image: 'camera.robot_map', repeats: 9 } });
    const rebuilt = vi.fn();
    card.addEventListener('ll-rebuild', rebuilt);
    document.body.append(card);
    await vi.waitFor(() => expect(rebuilt).toHaveBeenCalledTimes(1));
    expect(() => make({ map: { image: 'camera.robot_map', repeats: 9 } })).toThrow(
      'fluvy-vacuum-card: "map.repeats" must be 1 to 3',
    );
    expect(() => make({ presets: [{ name: 'A', zone: [1, 2] }] })).toThrow(
      'fluvy-vacuum-card: "presets[0].zone" must be four numbers',
    );
    expect(() => make({ map: MAP, presets: 'areas' })).not.toThrow();
  });
});

describe('the height the card declares', () => {
  const base = vacuumHeight({ type: 'x', entity: ROBOT });

  it('is the card’s own where it names no map and no preset', () => {
    // the head, the battery, the commands, two rows of suction chips (the house is not there to say), the foot
    expect(base).toBe(64 + 112 + 60 + 132 + 20);
    expect(vacuumHeight({ type: 'x', entity: ROBOT, show_map: true, show_presets: true })).toBe(
      base,
    );
  });

  it('takes the map’s plate, 16 under the head, in its shape across the column', () => {
    const tall = (map: object) => vacuumHeight({ type: 'x', entity: ROBOT, map }) - base;
    expect(tall({ image: 'camera.robot_map' })).toBe(16 + 240);
    expect(tall({ image: 'camera.robot_map', aspect_ratio: '1:1' })).toBe(16 + 320);
    expect(tall({ image: 'camera.robot_map', aspect_ratio: '16:9' })).toBe(16 + 180);
    // never the picture's own shape: its first frame would move the page
    expect(tall({ image: 'camera.robot_map', aspect_ratio: 'native' })).toBe(16 + 240);
  });

  it('takes none for a map hidden, or one that is no block', () => {
    expect(vacuumHeight({ type: 'x', entity: ROBOT, map: MAP, show_map: false })).toBe(base);
    expect(vacuumHeight({ type: 'x', entity: ROBOT, map: 'camera.robot_map' })).toBe(base);
  });

  it('takes the presets’ rows by their names, one for the house’s areas, none hidden', () => {
    const tall = (extra: object) => vacuumHeight({ type: 'x', entity: ROBOT, ...extra }) - base;
    const short = [{ name: 'Hall' }, { name: 'Bath' }, { name: 'Study' }];
    expect(tall({ presets: short })).toBe(16 + 44);
    expect(tall({ presets: [...short, { name: 'Under the table' }] })).toBe(16 + 88);
    expect(tall({ presets: 'areas' })).toBe(16 + 44);
    expect(tall({ presets: short, show_presets: false })).toBe(0);
    expect(tall({ presets: [] })).toBe(0);
    // content-sized chips wrap as their pills run, three rows of these, 8 apart
    expect(
      tall({
        presets: [...short, { name: 'Under the dining table' }, { name: 'The whole ground floor' }],
        presets_style: 'chips',
      }),
    ).toBe(16 + 132 + 16);
  });

  it('gives the suction’s room back where it is hidden', () => {
    expect(vacuumHeight({ type: 'x', entity: ROBOT, show_suction: false })).toBe(base - 132);
  });

  it('is the compact card’s whatever it names', () => {
    expect(
      vacuumHeight({
        type: 'x',
        entity: ROBOT,
        variant: 'compact',
        map: MAP,
        presets: [{ name: 'A' }],
      }),
    ).toBe(vacuumHeight({ type: 'x', entity: ROBOT, variant: 'compact' }));
  });
});

describe('a card that names no map and no preset', () => {
  it('draws neither, and is the card it was', async () => {
    const { hass } = house();
    const card = await draw(hass, {});
    expect(mapOf(card)).toBeNull();
    expect(root(card).querySelector('.vc-presets')).toBeNull();
    expect(parts(card)).toEqual(['.fv-card__head', '.vc-body']);
  });
});

describe('the card’s parts', () => {
  const PRESETS = [{ name: 'Cooker', zone: [1100, 100, 2000, 900] }, { name: 'Full clean' }];

  it('are the head, the map, the presets, then the card’s own', async () => {
    const { hass } = house();
    const card = await draw(hass, { map: MAP, presets: PRESETS });
    expect(parts(card)).toEqual(['.fv-card__head', 'fluvy-vacuum-map', '.vc-presets', '.vc-body']);
    expect(mapOf(card)?.height).toBe(240);
    expect(mapOf(card)?.width).toBe(320);
    // the presets alone, on a card with no map
    expect(parts(await draw(hass, { presets: PRESETS }))).toEqual([
      '.fv-card__head',
      '.vc-presets',
      '.vc-body',
    ]);
  });

  it('leave out what is hidden, and both on the compact card', async () => {
    const { hass } = house();
    const config = { map: MAP, presets: PRESETS };
    expect(parts(await draw(hass, { ...config, show_map: false, show_presets: false }))).toEqual([
      '.fv-card__head',
      '.vc-body',
    ]);
    expect(parts(await draw(hass, { ...config, variant: 'compact' }))).toEqual([
      '.fv-card__head',
      '.vc-body',
    ]);
  });

  it('keep the suction’s chips unless they are hidden', async () => {
    const { hass } = house();
    const shown = await draw(hass, {});
    expect(root(shown).querySelectorAll('.vc-part').length).toBe(2);
    const hidden = await draw(hass, { show_suction: false });
    expect(root(hidden).querySelectorAll('.vc-part').length).toBe(1);
  });
});

describe('a preset’s chip', () => {
  it('runs its zone as the robot’s integration takes it', async () => {
    const { hass, calls } = house();
    const card = await draw(hass, {
      map: MAP,
      presets: [{ name: 'Cooker', zone: [1100, 100, 2000, 900], repeats: 2 }],
    });
    expect(chips(card).map((chip) => chip.textContent?.trim())).toEqual(['Cooker']);
    chips(card)[0]!.click();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      action: 'xiaomi_miio.vacuum_clean_zone',
      data: { zone: [[1100, 100, 2000, 900]], repeats: 2 },
      target: { entity_id: [ROBOT] },
    });
  });

  it('that names nothing starts the robot; one with numbers of its own sends them', async () => {
    const { hass, calls } = house();
    const card = await draw(hass, {
      presets: [
        { name: 'Full clean' },
        {
          name: 'Table',
          zone: [10, 20, 30, 40],
          tap_action: {
            action: 'perform-action',
            perform_action: 'vacuum.send_command',
            data: { command: 'app_zoned_clean', params: '[[selection]]' },
          },
        },
      ],
    });
    for (const chip of chips(card)) chip.click();
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toEqual([
      { action: 'vacuum.start', data: {}, target: { entity_id: [ROBOT] } },
      {
        action: 'vacuum.send_command',
        data: { command: 'app_zoned_clean', params: [[10, 20, 30, 40]] },
        target: { entity_id: [ROBOT] },
      },
    ]);
  });

  it('asks first where it says so: Home Assistant’s own dialog, and no call of the card’s', async () => {
    const { hass, calls } = house();
    const card = await draw(hass, { presets: [{ name: 'Full clean', confirmation: true }] });
    const asked = vi.fn();
    card.addEventListener('hass-action', (event) => asked((event as CustomEvent).detail));
    chips(card)[0]!.click();
    await vi.waitFor(() => expect(asked).toHaveBeenCalledTimes(1));
    expect(asked.mock.calls[0]?.[0].config.tap_action).toMatchObject({
      action: 'perform-action',
      perform_action: 'vacuum.start',
      confirmation: true,
      target: { entity_id: [ROBOT] },
    });
    expect(calls).toEqual([]);
  });

  it('stands still where the robot has no way for it', async () => {
    const { hass, calls } = house();
    const card = await draw(hass, { presets: [{ name: 'Kitchen', areas: ['kitchen'] }] });
    expect(chips(card)[0]?.disabled).toBe(true);
    chips(card)[0]!.click();
    expect(calls).toEqual([]);
  });

  it('is in the dashed skin and takes no tap while the robot is out of reach', async () => {
    const { hass, calls } = house('unavailable');
    const card = await draw(hass, { map: MAP, presets: [{ name: 'Full clean' }] });
    expect(chips(card)[0]?.classList.contains('is-unavailable')).toBe(true);
    chips(card)[0]!.click();
    expect(calls).toEqual([]);
    expect(mapOf(card)?.still).toBe(true);
    expect(mapOf(card)?.shadowRoot?.querySelector('.vm-plate.is-off')).not.toBeNull();
  });
});

describe('the map', () => {
  const tags = (map: FluvyVacuumMap): HTMLButtonElement[] => [
    ...map.shadowRoot!.querySelectorAll<HTMLButtonElement>('.vm-tag'),
  ];
  const go = (map: FluvyVacuumMap) => map.shadowRoot!.querySelector<HTMLButtonElement>('.vm-go');
  const named = (map: FluvyVacuumMap, name: string): HTMLButtonElement =>
    tags(map).find((tag) => tag.textContent?.trim() === name)!;

  it('draws its rooms through its calibration, each with its name', async () => {
    const { hass } = house();
    const card = await draw(hass, { map: MAP });
    const map = await pictured(card);
    const shapes = [...map.shadowRoot!.querySelectorAll('.vm-shape--room')];
    expect(shapes.map((shape) => shape.getAttribute('points'))).toEqual([
      '0.0,0.0 100.0,0.0 100.0,100.0 0.0,100.0',
      '100.0,0.0 300.0,0.0 300.0,100.0 100.0,100.0',
    ]);
    expect(tags(map).map((tag) => tag.textContent?.trim())).toEqual(['Hall', 'Kitchen']);
  });

  it('a room tapped is picked, and Clean sends the rooms as the robot counts them', async () => {
    const { hass, calls } = house();
    const card = await draw(hass, { map: MAP });
    const map = await pictured(card);
    expect(go(map)).toBeNull();
    named(map, 'Kitchen').click();
    await card.updateComplete;
    await map.updateComplete;
    named(map, 'Hall').click();
    await card.updateComplete;
    await map.updateComplete;
    expect(map.chosen).toEqual({ kind: 'rooms', rooms: ['17', '16'] });
    expect(map.shadowRoot!.querySelector('.vm-bar__label')?.textContent).toBe('Kitchen, Hall');
    expect(go(map)?.textContent?.trim()).toBe('Clean');
    go(map)!.click();
    expect(calls).toEqual([
      {
        action: 'xiaomi_miio.vacuum_clean_segment',
        data: { segments: [17, 16] },
        target: { entity_id: [ROBOT] },
      },
    ]);
    await card.updateComplete;
    await map.updateComplete;
    // the robot asked, the map is as it was
    expect(map.chosen).toBeUndefined();
    expect(go(map)).toBeNull();
  });

  it('a preset’s chip held shows its zone on the map, lit, and Clean sends it its own times over', async () => {
    const { hass, calls } = house();
    const card = await draw(hass, {
      map: MAP,
      presets: [{ name: 'Cooker', zone: [1100, 100, 2000, 900], repeats: 3 }],
    });
    const map = await pictured(card);
    (chips(card)[0] as HTMLButtonElement & { fvHold?: () => void }).fvHold?.();
    await card.updateComplete;
    await map.updateComplete;
    expect(map.chosen).toEqual({ kind: 'zones', presets: [0] });
    expect(chips(card)[0]?.classList.contains('is-active')).toBe(true);
    expect(calls).toEqual([]);
    go(map)!.click();
    expect(calls[0]?.data).toEqual({ zone: [[1100, 100, 2000, 900]], repeats: 3 });
  });

  it('a point picked is the robot’s through the calibration, in whole numbers, and Go here sends it', async () => {
    const { hass, calls } = house();
    const card = await draw(hass, { map: MAP });
    const map = await pictured(card);
    const rounds = [
      ...map.shadowRoot!.querySelectorAll<HTMLButtonElement>('.vm-rounds--foot button'),
    ];
    expect(rounds.map((round) => round.getAttribute('aria-label'))).toEqual([
      'Mark a zone',
      'Pick a point',
    ]);
    rounds[1]!.click();
    await map.updateComplete;
    // the plate is 320 × 240 and the picture 300 × 100: 16 of the plate's pixels to 15 of its own, 66.67 down
    const layer = map.shadowRoot!.querySelector<HTMLElement>('.vm-layer')!;
    layer.dispatchEvent(
      new MouseEvent('click', { clientX: 160, clientY: 120, bubbles: true, composed: true }),
    );
    await card.updateComplete;
    await map.updateComplete;
    expect(map.chosen).toEqual({ kind: 'point', point: [1500, 500] });
    expect(go(map)?.textContent?.trim()).toBe('Go here');
    go(map)!.click();
    expect(calls).toEqual([
      {
        action: 'xiaomi_miio.vacuum_goto',
        data: { x_coord: 1500, y_coord: 500 },
        target: { entity_id: [ROBOT] },
      },
    ]);
  });

  it('draws no round for a mode the config leaves out, and nothing to pick where it is not calibrated', async () => {
    const { hass } = house();
    const one = await pictured(await draw(hass, { map: { ...MAP, controls: ['names', 'point'] } }));
    expect(
      [...one.shadowRoot!.querySelectorAll('.vm-rounds--foot button')].map((round) =>
        round.getAttribute('aria-label'),
      ),
    ).toEqual(['Pick a point']);
    const plain = await pictured(
      await draw(hass, { map: { image: '/local/floor.png', rooms: ROOMS } }),
    );
    expect(plain.shadowRoot!.querySelector('.vm-rounds--foot')).toBeNull();
    expect(plain.shadowRoot!.querySelectorAll('.vm-shape, .vm-tag').length).toBe(0);
  });

  it('keeps its plate, with no picture to show: the map’s glyph and why', async () => {
    const { hass } = house();
    const card = await draw(hass, { map: { image: 'camera.gone' } });
    const off = mapOf(card)!.shadowRoot!.querySelector<HTMLElement>('.vm-plate.is-off');
    expect(off?.style.height).toBe('240px');
    expect(off?.getAttribute('aria-label')).toBe('No map');
  });
});

describe('the editor', () => {
  const form = getConfigForm();
  const shown = (data: Record<string, unknown>, hass?: HomeAssistant): string[] => {
    const names: string[] = [];
    const walk = (items: readonly { name: string; schema?: readonly unknown[] }[]): void => {
      for (const item of items) {
        if (item.name) names.push(item.name);
        if (item.schema && item.name !== 'map')
          walk(item.schema as { name: string; schema?: readonly unknown[] }[]);
      }
    };
    walk(visibleFields(form.schema, data, hass) as never);
    return names;
  };

  it('offers the map as a block of its own, and what hides a part only once the card has that part', () => {
    const bare = shown({ variant: 'full' });
    expect(bare).toContain('map');
    expect(bare).toContain('show_suction');
    expect(bare).not.toContain('show_map');
    expect(bare).not.toContain('show_presets');
    const whole = shown({ variant: 'full', map: MAP, presets: [{ name: 'A' }] });
    expect(whole).toEqual(expect.arrayContaining(['show_map', 'show_presets', 'presets_style']));
    const compact = shown({ variant: 'compact', map: MAP, presets: [{ name: 'A' }] });
    for (const name of ['map', 'show_map', 'show_presets', 'show_suction'])
      expect(compact).not.toContain(name);
  });

  it('holds the map’s own fields under its key, its calibration typed, or as YAML where it is points', () => {
    const block = (data: Record<string, unknown>) =>
      (visibleFields(form.schema, data).find((item) => item.name === 'map')?.schema ?? []).flatMap(
        (item) => (item.schema ? item.schema : [item]),
      );
    const names = (data: Record<string, unknown>): string[] => block(data).map((item) => item.name);
    expect(names({ map: MAP })).toEqual([
      'image',
      'calibration',
      'aspect_ratio',
      'controls',
      'repeats',
      'topic',
      'rooms',
      'room_action',
      'zone_action',
      'point_action',
    ]);
    const typed = block({ map: MAP }).find((item) => item.name === 'calibration');
    expect(typed?.selector).toHaveProperty('text');
    const pointed = block({ map: { ...MAP, calibration: CALIBRATION } }).filter(
      (item) => item.name === 'calibration',
    );
    expect(pointed).toHaveLength(1);
    expect(pointed[0]?.selector).toHaveProperty('object');
  });

  it('edits the presets item by item, by their names', () => {
    const [presets] = lists;
    expect([presets?.key, presets?.idKey]).toEqual(['presets', 'name']);
    const fields = (item: Record<string, unknown>): string[] =>
      (presets?.schemaOf?.(item) ?? []).flatMap((field) =>
        field.schema ? field.schema.map((inner) => inner.name) : [field.name],
      );
    expect(fields({ name: 'A', zone: [1, 2, 3, 4] })).toContain('zone');
    expect(fields({ name: 'A', zone: [1, 2, 3, 4] })).not.toContain('zones');
    expect(fields({ name: 'A', zones: [[1, 2, 3, 4]] })).toContain('zones');
    expect(fields({ name: 'A', zones: [[1, 2, 3, 4]] })).not.toContain('zone');
    // what a preset answers stands in its Interactions, as every item's does
    expect(presets?.keys).toEqual(
      expect.arrayContaining(['tap_action', 'hold_action', 'double_tap_action']),
    );
    // the house's areas are YAML's word: no list to edit over it
    expect(presets?.when?.({ presets: 'areas' })).toBe(false);
    expect(presets?.when?.({ presets: [] })).toBe(true);
    expect(presets?.when?.({ variant: 'compact' })).toBe(false);
  });
});
