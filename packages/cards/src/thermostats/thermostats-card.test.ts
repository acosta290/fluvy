// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { ROOM_GLYPHS } from '@fluvy/ui/glyph-sets/rooms';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { houseHeightOf } from '../house-heights.js';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, listTitles, shownNames } from '../shared/fixtures/editor.js';
import { visibleFields } from '../shared/form.js';
import { thermostatsHeight } from '../thermostats-family.js';
import { houseThermostats, presetsOffered } from './house.js';
import { FluvyThermostatsCard } from './thermostats-card.js';
import * as thermostatsEditor from './thermostats-editor.js';

// the index fetches the lazy families, the thermostats among them: the card's tag is defined before a page needs it
beforeAll(() => familiesDefined);
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

/*
 * The Thermostats card (#230, requested by @xoatrash; #219, @waphbs's house card): every thermostat of a house in one
 * card. The house: a living room's heat pump heating from 20.5° to 21° (a whole degree a step, its own off), the
 * bedroom's valve idle at 19° on Eco, the kids' room heating on Comfort, the office off and the bathroom's valve out
 * of reach (half a degree a step, off by their mode); its rooms on two floors, the ground's first.
 */

const STAMP = '2026-11-19T08:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});

const VALVE = {
  min_temp: 5,
  max_temp: 30,
  target_temp_step: 0.5,
  hvac_modes: ['off', 'heat', 'auto'],
  preset_modes: ['none', 'eco', 'comfort', 'boost'],
  supported_features: 17,
};
const PUMP = {
  min_temp: 16,
  max_temp: 30,
  target_temp_step: 1,
  hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
  preset_modes: ['none', 'eco', 'comfort'],
  supported_features: 401,
};

const STATES = {
  'climate.living': state('climate.living', 'heat', {
    friendly_name: 'Living room heat pump',
    ...PUMP,
    temperature: 21,
    current_temperature: 20.5,
    hvac_action: 'heating',
    preset_mode: 'none',
  }),
  'climate.bedroom': state('climate.bedroom', 'heat', {
    friendly_name: 'Bedroom radiator',
    ...VALVE,
    temperature: 19,
    current_temperature: 19.4,
    hvac_action: 'idle',
    preset_mode: 'eco',
  }),
  'climate.kids': state('climate.kids', 'heat', {
    friendly_name: 'Kids room radiator',
    ...VALVE,
    temperature: 21.5,
    current_temperature: 20.8,
    hvac_action: 'heating',
    preset_mode: 'comfort',
  }),
  'climate.office': state('climate.office', 'off', {
    friendly_name: 'Office radiator',
    ...VALVE,
    temperature: 20,
    current_temperature: 18.2,
    hvac_action: 'off',
  }),
  'climate.bathroom': state('climate.bathroom', 'unavailable', {
    friendly_name: 'Bathroom radiator',
    ...VALVE,
  }),
  'water_heater.tank': state('water_heater.tank', 'eco', {
    friendly_name: 'Hot water',
    temperature: 55,
    current_temperature: 48,
  }),
  'climate.hidden': state('climate.hidden', 'heat', { friendly_name: 'Hidden' }),
  'binary_sensor.bedroom_window': state('binary_sensor.bedroom_window', 'off', {
    friendly_name: 'Bedroom window',
    device_class: 'window',
  }),
};
const HOUSE = [
  'climate.living',
  'climate.bedroom',
  'climate.kids',
  'climate.office',
  'climate.bathroom',
];

const area = (area_id: string, name: string, icon: string, floor_id: string) => ({
  area_id,
  name,
  icon,
  floor_id,
  picture: null,
});

/** The house, with the calls it is sent kept. */
const house = (states: Record<string, unknown> = STATES) => {
  const calls: unknown[][] = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' } },
    states,
    entities: {
      'climate.living': { entity_id: 'climate.living', area_id: 'living' },
      'climate.bedroom': { entity_id: 'climate.bedroom', area_id: 'bedroom' },
      'climate.kids': { entity_id: 'climate.kids', area_id: 'kids' },
      'climate.office': { entity_id: 'climate.office', area_id: 'office' },
      'climate.bathroom': { entity_id: 'climate.bathroom', area_id: 'bathroom' },
      'water_heater.tank': { entity_id: 'water_heater.tank', area_id: 'bathroom' },
      'climate.hidden': { entity_id: 'climate.hidden', area_id: 'living', hidden: true },
    },
    devices: {},
    floors: {
      first: { floor_id: 'first', name: 'First floor', level: 1, icon: null },
      ground: { floor_id: 'ground', name: 'Ground floor', level: 0, icon: null },
    },
    areas: {
      bedroom: area('bedroom', 'Bedroom', 'mdi:bed', 'first'),
      bathroom: area('bathroom', 'Bathroom', 'mdi:shower', 'first'),
      kids: area('kids', 'Kids room', 'mdi:teddy-bear', 'first'),
      living: area('living', 'Living room', 'mdi:sofa', 'ground'),
      office: area('office', 'Office', 'mdi:desk', 'ground'),
    },
    user: { id: 'u', is_admin: true },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: (...call: unknown[]) => (calls.push(call), Promise.resolve()),
  } as unknown as HomeAssistant;
  return { hass, calls };
};

type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};
type Pressed = HTMLElement & { fvTap?: () => void; fvHold?: () => void };

async function drawn(
  config: Partial<LovelaceCardConfig>,
  hass = house().hass,
  width = 360,
): Promise<CardElement> {
  const card = document.createElement('fluvy-thermostats-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-thermostats-card', thermostats: HOUSE, ...config });
  card.hass = hass;
  (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  return card;
}
const root = (card: CardElement): ShadowRoot => card.shadowRoot!;
const rows = (card: CardElement): Pressed[] => [
  ...root(card).querySelectorAll<Pressed>('.ts-list .fv-row'),
];
const text = (node: Element | null | undefined): string => node?.textContent?.trim() ?? '';
const chips = (card: CardElement): HTMLButtonElement[] => [
  ...root(card).querySelectorAll<HTMLButtonElement>('.ts-actions .fv-chip'),
];
const sent = (calls: readonly unknown[][]): string[] =>
  calls.map(
    ([domain, service, data, target]) =>
      `${String(domain)}.${String(service)} ${JSON.stringify(data)} ${
        (target as { entity_id?: string } | undefined)?.entity_id ?? ''
      }`,
  );

describe('the Thermostats card (#230, #219)', () => {
  it('lists the house’s climates where it lists none, in the house’s order of its rooms; an area’s alone where it names one', () => {
    const { hass } = house();
    // the ground floor first (the living room, the office), then the first floor's by name; never the water heater
    // nor what the house hides
    expect(houseThermostats(hass)).toEqual([
      'climate.living',
      'climate.office',
      'climate.bathroom',
      'climate.bedroom',
      'climate.kids',
    ]);
    expect(houseThermostats(hass, 'kids')).toEqual(['climate.kids']);
    expect(houseThermostats(hass, 'nowhere')).toEqual([]);
  });

  it('draws a row each: its room’s glyph and name, what it is doing, its preset and its target, what the room measures', async () => {
    const card = await drawn({});
    const all = rows(card);
    expect(all.map((row) => text(row.querySelector('.fv-row__title')))).toEqual([
      'Living room',
      'Bedroom',
      'Kids room',
      'Office',
      'Bathroom',
    ]);
    expect(all.map((row) => text(row.querySelector('.fv-row__sub')))).toEqual([
      'Heating · 21°',
      'Idle · Eco · 19.0°',
      'Heating · Comfort · 21.5°',
      'Off',
      'Unavailable',
    ]);
    expect(all.map((row) => text(row.querySelector('.fv-row__value')))).toEqual([
      '20.5°',
      '19.4°',
      '20.8°',
      '18.2°',
      '—',
    ]);
    // the circle in what it is doing's tone: heating the heat's, idle and off quiet, out of reach the dashed ring
    const tones = all.map((row) =>
      [...row.querySelector('.fv-ico')!.classList].find((cls) => cls.startsWith('fv-ico--')),
    );
    expect(tones).toEqual([
      'fv-ico--heat',
      'fv-ico--neutral',
      'fv-ico--heat',
      'fv-ico--neutral',
      'fv-ico--off',
    ]);
    // the room's glyph, the area's icon as Fluvy's set draws it: the sofa, the bed
    const path = (glyph: string): string => /d="([^"]+)"/.exec(glyph)![1]!;
    expect(all[0]!.querySelector('.fv-ico')!.innerHTML).toContain(path(ROOM_GLYPHS.livingRoom));
    expect(all[1]!.querySelector('.fv-ico')!.innerHTML).toContain(path(ROOM_GLYPHS.bedroom));
    // each row ends in the round that opens it
    expect(all.map((row) => row.querySelectorAll('.lt-bulb').length)).toEqual([1, 1, 1, 1, 1]);
  });

  it('names a row its own name, its entity’s where the card asks, its entity’s where two share a room', async () => {
    const own = await drawn({
      thermostats: [{ entity: 'climate.living', name: 'Lounge' }, 'climate.bedroom'],
    });
    expect(rows(own).map((row) => text(row.querySelector('.fv-row__title')))).toEqual([
      'Lounge',
      'Bedroom',
    ]);
    const asked = await drawn({ thermostats: ['climate.living'], names: 'full' });
    expect(text(rows(asked)[0]!.querySelector('.fv-row__title'))).toBe('Living room heat pump');
    const room = await drawn({ thermostats: ['climate.living'], names: 'area' });
    expect(text(rows(room)[0]!.querySelector('.fv-row__title'))).toBe('Living room');
    const { hass } = house();
    const shared = {
      ...hass,
      entities: {
        ...hass.entities,
        'climate.office': { entity_id: 'climate.office', area_id: 'living' },
      },
    } as HomeAssistant;
    const two = await drawn({ thermostats: ['climate.living', 'climate.office'] }, shared);
    expect(rows(two).map((row) => text(row.querySelector('.fv-row__title')))).toEqual([
      'Living room heat pump',
      'Office radiator',
    ]);
  });

  it('opens a row’s details at a tap and a hold; out of reach it takes no tap, its hold still opens it', async () => {
    const opened: string[] = [];
    const open = (event: Event): void =>
      void opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    document.addEventListener('hass-more-info', open);
    try {
      const card = await drawn({});
      const all = rows(card);
      all[1]!.click();
      expect(all[4]!.fvTap).toBeUndefined();
      all[4]!.fvHold?.();
      await new Promise((resolve) => setTimeout(resolve));
      expect(opened).toEqual(['climate.bedroom', 'climate.bathroom']);
    } finally {
      document.removeEventListener('hass-more-info', open);
    }
  });

  it('draws a row’s own rounds after the one that opens it, or alone where it is asked away', async () => {
    const card = await drawn({
      thermostats: [{ entity: 'climate.bedroom', rounds: ['binary_sensor.bedroom_window'] }],
    });
    const rounds = [...rows(card)[0]!.querySelectorAll('.lt-bulb')];
    expect(rounds.map((round) => round.getAttribute('aria-label'))).toEqual([
      'Bedroom radiator',
      'Bedroom window',
    ]);
    const alone = await drawn({
      show_round: false,
      thermostats: [{ entity: 'climate.bedroom', rounds: ['binary_sensor.bedroom_window'] }],
    });
    expect(
      [...rows(alone)[0]!.querySelectorAll('.lt-bulb')].map((round) =>
        round.getAttribute('aria-label'),
      ),
    ).toEqual(['Bedroom window']);
  });

  it('a head where asked: how many heat, else cool, else are on, else how many there are; the house’s average', async () => {
    const titled = await drawn({ title: 'Heating', show_count: true, show_average: true });
    expect(text(root(titled).querySelector('.fv-card__title'))).toBe('Heating');
    // of the four that can be read: 20.5, 19.4, 20.8 and 18.2
    expect(text(root(titled).querySelector('.fv-card__sub'))).toBe(
      '2 of 4 heating · 19.7° average',
    );
    const bare = await drawn({});
    expect(root(bare).querySelector('.fv-card__head')).toBeNull();
    // a count alone brings the head, its title the card's word
    const counted = await drawn({ show_count: true });
    expect(text(root(counted).querySelector('.fv-card__title'))).toBe('Thermostats');
    const { hass } = house();
    const summer = {
      ...hass,
      states: {
        ...hass.states,
        'climate.living': state('climate.living', 'cool', {
          ...PUMP,
          temperature: 24,
          current_temperature: 26,
          hvac_action: 'cooling',
        }),
        'climate.kids': state('climate.kids', 'heat', { ...VALVE, hvac_action: 'idle' }),
      },
    } as HomeAssistant;
    const cooling = await drawn({ show_count: true }, summer);
    expect(text(root(cooling).querySelector('.fv-card__sub'))).toBe('1 of 4 cooling');
    const idle = {
      ...summer,
      states: {
        ...summer.states,
        'climate.living': state('climate.living', 'heat', { ...PUMP, hvac_action: 'idle' }),
      },
    } as HomeAssistant;
    expect(text(root(await drawn({ show_count: true }, idle)).querySelector('.fv-card__sub'))).toBe(
      '3 of 4 on',
    );
    const off = await drawn({ show_count: true, thermostats: ['climate.office'] });
    expect(text(root(off).querySelector('.fv-card__sub'))).toBe('1 thermostat');
  });

  it('the stepper: each thermostat’s own step and range, shown at once and sent after the taps settle', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { hass, calls } = house({
      ...STATES,
      'climate.living': state('climate.living', 'heat', {
        ...PUMP,
        friendly_name: 'Living room heat pump',
        temperature: 29,
        current_temperature: 20.5,
        hvac_action: 'heating',
      }),
    });
    const card = await drawn({ control: 'stepper' }, hass);
    const pills = [...root(card).querySelectorAll('.fv-stepper--value')];
    expect(pills.map((pill) => text(pill.querySelector('.fv-stepper__value')))).toEqual([
      '29°',
      '19.0°',
      '21.5°',
      'Off',
      '—',
    ]);
    // the room's reading leads the line where the target is the control
    expect(text(rows(card)[0]!.querySelector('.fv-row__sub'))).toBe('20.5° · Heating');
    const plus = (index: number): HTMLButtonElement =>
      pills[index]!.querySelectorAll<HTMLButtonElement>('.fv-stepper__half')[1]!;
    // a whole degree on the heat pump, kept under its 30; half a degree on the bedroom's valve
    const step = (half: HTMLButtonElement): void => {
      half.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      half.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    };
    step(plus(0));
    step(plus(0));
    step(plus(1));
    await card.updateComplete;
    expect(text(root(card).querySelectorAll('.fv-stepper__value')[0])).toBe('30°');
    expect(text(root(card).querySelectorAll('.fv-stepper__value')[1])).toBe('19.5°');
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(700);
    expect(sent(calls)).toEqual([
      'climate.set_temperature {"temperature":30} climate.living',
      'climate.set_temperature {"temperature":19.5} climate.bedroom',
    ]);
    // off and out of reach: still
    const halves = [
      ...pills[3]!.querySelectorAll('button'),
      ...pills[4]!.querySelectorAll('button'),
    ];
    expect(halves.every((half) => half.disabled)).toBe(true);
  });

  it('a range, as heat_cool and as auto spell it: its low end stepped, its high one while it cools', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const range = (id: string, mode: string, action: string) =>
      state(id, mode, {
        friendly_name: id,
        min_temp: 16,
        max_temp: 30,
        target_temp_step: 0.5,
        hvac_modes: ['off', 'heat', 'cool', mode],
        supported_features: 2,
        target_temp_low: 20,
        target_temp_high: 24,
        current_temperature: 22,
        hvac_action: action,
      });
    const { hass, calls } = house({
      'climate.upstairs': range('climate.upstairs', 'heat_cool', 'heating'),
      'climate.attic': range('climate.attic', 'auto', 'cooling'),
    });
    const card = await drawn(
      { control: 'stepper', thermostats: ['climate.upstairs', 'climate.attic'] },
      hass,
    );
    const values = (): string[] =>
      [...root(card).querySelectorAll('.fv-stepper__value')].map((value) => text(value));
    expect(values()).toEqual(['20.0–24.0°', '20.0–24.0°']);
    for (const pill of root(card).querySelectorAll('.fv-stepper--value')) {
      const plus = pill.querySelectorAll('.fv-stepper__half')[1]!;
      plus.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      plus.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    }
    await card.updateComplete;
    expect(values()).toEqual(['20.5–24.0°', '20.0–24.5°']);
    await vi.advanceTimersByTimeAsync(700);
    expect(sent(calls)).toEqual([
      'climate.set_temperature {"target_temp_low":20.5,"target_temp_high":24} climate.upstairs',
      'climate.set_temperature {"target_temp_low":20,"target_temp_high":24.5} climate.attic',
    ]);
  });

  it('All off asks Home Assistant first, then turns off each one that is on as it takes it: never one off or out of reach', async () => {
    const asked: { node: EventTarget; action: Record<string, unknown> }[] = [];
    const ask = (event: Event): void =>
      void asked.push({
        node: event.composedPath()[0]!,
        action: (event as CustomEvent<{ config: { tap_action: Record<string, unknown> } }>).detail
          .config.tap_action,
      });
    document.addEventListener('hass-action', ask);
    try {
      const { hass, calls } = house();
      const card = await drawn({ house_actions: ['all_off'] }, hass);
      const [allOff] = chips(card);
      expect(text(allOff)).toBe('All off');
      allOff!.click();
      await new Promise((resolve) => setTimeout(resolve));
      expect(calls).toEqual([]);
      expect(asked).toHaveLength(1);
      expect(asked[0]!.action['confirmation']).toEqual({
        text: 'Turn off the 3 thermostats that are on?',
      });
      asked[0]!.node.dispatchEvent(
        new CustomEvent('ll-custom', { detail: asked[0]!.action, bubbles: true, composed: true }),
      );
      // the heat pump by its own off, the valves by their Off mode
      expect(sent(calls)).toEqual([
        'climate.turn_off {} climate.living',
        'climate.set_hvac_mode {"hvac_mode":"off"} climate.bedroom',
        'climate.set_hvac_mode {"hvac_mode":"off"} climate.kids',
      ]);
      // drawn off at once
      await card.updateComplete;
      expect(text(rows(card)[0]!.querySelector('.fv-row__sub'))).toBe('Off');
      // nothing on: held
      const off = await drawn(
        { house_actions: ['all_off'], thermostats: ['climate.office'] },
        hass,
      );
      expect(chips(off)[0]!.disabled).toBe(true);
    } finally {
      document.removeEventListener('hass-action', ask);
    }
  });

  it('the presets they offer between them, each saying how many offer it, set on each one that is on and offers it', async () => {
    const { hass, calls } = house();
    const card = await drawn({ house_actions: ['presets', 'all_off'] }, hass);
    // of the four that can be read, every one offers Eco and Comfort, three Boost; All off after them, as asked
    expect(chips(card).map((chip) => text(chip))).toEqual([
      'Eco',
      'Comfort',
      'Boost 3/4',
      'All off',
    ]);
    // nothing chosen: the bedroom is on Eco, the kids' room on Comfort
    expect(chips(card).map((chip) => chip.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'false',
    ]);
    chips(card)[2]!.click();
    // Boost on the two valves that are on; never the heat pump, which has none, nor the office, which is off
    expect(sent(calls)).toEqual([
      'climate.set_preset_mode {"preset_mode":"boost"} climate.bedroom',
      'climate.set_preset_mode {"preset_mode":"boost"} climate.kids',
    ]);
    const { hass: eco } = house({
      ...STATES,
      'climate.living': state('climate.living', 'heat', { ...PUMP, preset_mode: 'eco' }),
      'climate.kids': state('climate.kids', 'heat', { ...VALVE, preset_mode: 'eco' }),
    });
    const chosen = await drawn({ house_actions: ['presets'] }, eco);
    expect(chips(chosen)[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(presetsOffered(undefined, [])).toEqual([]);
  });

  it('declares its height from its config, and from what the house says where it lists none', () => {
    const height = (config: Partial<LovelaceCardConfig>): number =>
      FluvyThermostatsCard.layoutHeight({
        type: 'custom:fluvy-thermostats-card',
        thermostats: HOUSE,
        ...config,
      });
    // five rows of 60, 8 into the card's padding at each end
    expect(height({})).toBe(20 - 8 + 5 * 60 - 8 + 20);
    // a head: the rows' circles 16 under it
    expect(height({ title: 'Heating' })).toBe(20 + 44 + 8 + 5 * 60 - 8 + 20);
    expect(height({ show_count: true, variant: 'compact' })).toBe(20 + 44 + 14 + 5 * 48 - 2 + 20);
    // tiles two a row, 8 apart
    expect(height({ variant: 'tiles' })).toBe(20 + 3 * 84 + 2 * 8 + 20);
    // the house's actions: All off and one preset chip where the house is not there to say, one row
    expect(height({ title: 'Heating', house_actions: ['all_off', 'presets'] })).toBe(
      20 + 44 + 12 + 44 + 4 + 5 * 60 - 8 + 20,
    );
    // none listed: three, where the house is not there to say
    expect(height({ thermostats: undefined })).toBe(20 - 8 + 3 * 60 - 8 + 20);
    // the stepper and the round never change it: a row never stacks
    expect(height({ control: 'stepper', show_round: false })).toBe(height({}));
    // the house's own: its five climates, and its presets' chips
    const { hass } = house();
    const config = {
      type: 'custom:fluvy-thermostats-card',
      house_actions: ['all_off', 'presets'],
    };
    expect(houseHeightOf(config, -1, hass)).toBe(
      thermostatsHeight(config, { count: 5, presets: ['Eco', 'Comfort', 'Boost 3/4'] }),
    );
    // a room with none: the panel and its hint
    expect(houseHeightOf({ ...config, area: 'nowhere' }, -1, hass)).toBe(172);
  });

  it('a room with none says so in its panel', async () => {
    const card = await drawn({ thermostats: undefined, area: 'nowhere', title: 'Hallway' });
    expect(text(root(card).querySelector('.fv-empty-state__text'))).toBe('No thermostats here');
  });

  it('tiles: two a row, each its room’s glyph, its name and the room’s reading, filled while it does anything', async () => {
    const card = await drawn({ variant: 'tiles' });
    const tiles = [...root(card).querySelectorAll('.fv-option')];
    expect(tiles.map((tile) => text(tile.querySelector('.fv-option__value')))).toEqual([
      '20.5°',
      '19.4°',
      '20.8°',
      '18.2°',
      '—',
    ]);
    expect(tiles.map((tile) => tile.classList.contains('is-active'))).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
    expect(tiles[4]!.classList.contains('is-unavailable')).toBe(true);
    expect(root(card).querySelector<HTMLElement>('.fv-options')!.style.gridTemplateColumns).toBe(
      'repeat(2, minmax(0, 1fr))',
    );
  });

  it('its editor: its thermostats a list of their own, what acts only where it does', async () => {
    const editor = await drawEditor(await FluvyThermostatsCard.getConfigElement(), {
      type: 'custom:fluvy-thermostats-card',
      thermostats: HOUSE,
    });
    expect(listTitles(editor)).toEqual(['Thermostats']);
    const shown = (data: Record<string, unknown>): string[] =>
      shownNames(visibleFields(thermostatsEditor.getConfigForm().schema, data));
    const listed = shown({ thermostats: HOUSE });
    expect(listed).toEqual(
      expect.arrayContaining(['variant', 'control', 'show_round', 'house_actions']),
    );
    expect(listed).not.toContain('area');
    expect(listed).not.toContain('tap_action');
    expect(shown({})).toContain('area');
    const tiles = shown({ thermostats: HOUSE, variant: 'tiles' });
    expect(tiles).not.toContain('control');
    expect(tiles).not.toContain('show_round');
    // a thermostat's own rounds only where it is a row: tiles draw none
    const [list] = thermostatsEditor.lists;
    const itemNames = (variant?: string): string[] =>
      shownNames(list!.schemaOf!({ entity: 'climate.living' }, { variant }) ?? list!.schema);
    expect(itemNames()).toContain('rounds');
    expect(itemNames('compact')).toContain('rounds');
    expect(itemNames('tiles')).not.toContain('rounds');
    expect(shown({ thermostats: HOUSE, title: 'Heating' })).toEqual(
      expect.arrayContaining(['show_icon', 'tap_action']),
    );
    expect(cardForm(editor).schema.length).toBeGreaterThan(0);
  });
});
