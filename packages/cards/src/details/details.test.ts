// @vitest-environment happy-dom
import {
  runAction,
  setDetailsSheets,
  type HassEntity,
  type HomeAssistant,
  type Sheets,
} from '@fluvy/core';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { detailsSheets } from '../details-family.js';
import { openDetails } from './open.js';
import type { DetailsSheet } from './sheet.js';

/*
 * Fluvy's own details sheets (#162): who opens them (the kinds with a sheet, the house's choice, an action's own),
 * each kind's sheet and what its dial, its keys and its rows call, what an entity's features leave out, a sheet out
 * of reach, and the dialog itself: its focus, its ways out, the round to Home Assistant's own details and the day's
 * way to History.
 */

const STAMP = '2026-11-13T19:00:00+00:00';
const entity = (
  entity_id: string,
  state: string,
  attributes: Record<string, unknown>,
): HassEntity => ({
  entity_id,
  state,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});

type House = HomeAssistant & { callService: Mock; callWS: Mock };

const house = (...states: HassEntity[]): House =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' } },
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
    entities: {},
    devices: {},
    areas: {},
    callService: vi.fn(async () => undefined),
    callWS: vi.fn(async () => ({})),
  }) as unknown as House;

const FLOOR = entity('light.floor', 'on', {
  friendly_name: 'Floor lamp',
  supported_color_modes: ['hs', 'color_temp'],
  color_mode: 'hs',
  brightness: 184,
  rgb_color: [255, 166, 87],
  hs_color: [28, 66],
  min_color_temp_kelvin: 2000,
  max_color_temp_kelvin: 6500,
  effect_list: ['None', 'Candle', 'Fireplace'],
  effect: 'None',
  supported_features: 4,
});
const FAIRY = entity('light.fairy', 'on', {
  friendly_name: 'Fairy lights',
  supported_color_modes: ['onoff'],
});
const THERMOSTAT = entity('climate.living', 'heat', {
  friendly_name: 'Thermostat',
  temperature: 21.5,
  current_temperature: 20.8,
  current_humidity: 46,
  min_temp: 15,
  max_temp: 30,
  target_temp_step: 0.5,
  hvac_modes: ['off', 'heat', 'cool'],
  hvac_action: 'heating',
  preset_modes: ['eco', 'comfort'],
  preset_mode: 'comfort',
  fan_modes: ['auto', 'low'],
  fan_mode: 'auto',
  swing_modes: ['off', 'vertical'],
  swing_mode: 'off',
  swing_horizontal_modes: ['off', 'on'],
  swing_horizontal_mode: 'off',
});
const RANGE = entity('climate.study', 'heat_cool', {
  friendly_name: 'Study',
  supported_features: 2,
  hvac_modes: ['off', 'heat_cool'],
  min_temp: 15,
  max_temp: 30,
  target_temp_step: 0.5,
  target_temp_low: 20,
  target_temp_high: 24,
  hvac_action: 'idle',
});
const TANK = entity('water_heater.tank', 'eco', {
  friendly_name: 'Water heater',
  operation_list: ['off', 'eco', 'performance'],
  temperature: 52,
  min_temp: 40,
  max_temp: 65,
});
const HUMIDIFIER = entity('humidifier.nursery', 'on', {
  friendly_name: 'Humidifier',
  available_modes: ['normal', 'sleep'],
  mode: 'sleep',
  humidity: 50,
});
const BLIND = entity('cover.blind', 'open', {
  friendly_name: 'Blind',
  current_position: 65,
  current_tilt_position: 40,
  supported_features: 1 | 2 | 4 | 8 | 16 | 32 | 128,
});
const GARAGE = entity('cover.garage', 'closed', {
  friendly_name: 'Garage door',
  supported_features: 1 | 2,
});
const VALVE = entity('valve.garden', 'closed', {
  friendly_name: 'Garden water',
  current_position: 0,
  supported_features: 1 | 2 | 4 | 8,
});
const SPEAKER = entity('media_player.kitchen', 'playing', {
  friendly_name: 'Kitchen speaker',
  media_title: 'Weightless',
  media_artist: 'Marconi Union',
  entity_picture: 'https://ha.example/art.jpg',
  volume_level: 0.32,
  is_volume_muted: false,
  source_list: ['Spotify', 'Radio'],
  source: 'Spotify',
  sound_mode_list: ['Music', 'Night'],
  sound_mode: 'Music',
  supported_features: 1 | 4 | 8 | 16 | 32 | 128 | 256 | 2048 | 16384 | 65536,
});
const RADIO = entity('media_player.radio', 'idle', {
  friendly_name: 'Radio',
  supported_features: 16384,
});
const CEILING_FAN = entity('fan.ceiling', 'on', {
  friendly_name: 'Ceiling fan',
  percentage: 66.66,
  percentage_step: 33.33,
  oscillating: true,
  direction: 'forward',
  preset_modes: ['auto', 'sleep'],
  preset_mode: null,
  supported_features: 1 | 2 | 4 | 8,
});
const EXTRACTOR = entity('fan.extractor', 'off', {
  friendly_name: 'Extractor',
  supported_features: 0,
});

type Sheet = DetailsSheet & { updateComplete: Promise<boolean> };

/** A kind's sheet docked (no dialog) on a house. */
async function docked(tag: string, state: HassEntity, hass: House = house(state)): Promise<Sheet> {
  const sheet = document.createElement(tag) as Sheet;
  sheet.setConfig({ type: `custom:${tag}`, entity: state.entity_id, _docked: true });
  sheet.hass = hass;
  document.body.append(sheet);
  await sheet.updateComplete;
  return sheet;
}

const root = (sheet: Sheet): ShadowRoot => sheet.shadowRoot!;
const one = <T extends Element = HTMLElement>(sheet: Sheet, selector: string): T =>
  root(sheet).querySelector<T>(selector)!;
const text = (sheet: Sheet, selector: string): string =>
  one(sheet, selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const keyIds = (sheet: Sheet): string[] =>
  [...root(sheet).querySelectorAll<HTMLElement>('.dt-keys .fv-action')].map(
    (key) => key.dataset['key'] ?? '',
  );
const rowTitles = (sheet: Sheet): string[] =>
  [...root(sheet).querySelectorAll('.dt-rows .fv-row__title')].map(
    (title) => title.textContent?.trim() ?? '',
  );
/** The dial as its sheet set it. */
const dial = (sheet: Sheet): HTMLElement & Record<string, unknown> =>
  one(sheet, 'fluvy-dial') as HTMLElement & Record<string, unknown>;
const turn = (sheet: Sheet, detail: Record<string, number>, type = 'fluvy-change'): void => {
  dial(sheet).dispatchEvent(new CustomEvent(type, { detail }));
};
const press = (sheet: Sheet, key: string): void =>
  one<HTMLButtonElement>(sheet, `.dt-keys [data-key="${key}"]`).click();
/** A step key pressed from the keyboard: a click with no pointer behind it. */
const step = (sheet: Sheet, key: string): void => {
  one(sheet, `.dt-keys [data-key="${key}"]`).dispatchEvent(new MouseEvent('click', { detail: 0 }));
};
/** A row's dropdown choosing an option, by the row's name. */
const choose = (sheet: Sheet, title: string, value: string): void => {
  const row = [...root(sheet).querySelectorAll('.dt-rows .fv-row')].find(
    (candidate) => candidate.querySelector('.fv-row__title')?.textContent?.trim() === title,
  )!;
  row
    .querySelector('fluvy-select')!
    .dispatchEvent(new CustomEvent('fluvy-change', { detail: { value } }));
};
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
/** The services called, each with its data and the entity it went to. */
const calls = (hass: House): unknown[][] =>
  hass.callService.mock.calls.map(([domain, service, data, target]) => [
    `${domain}.${service}`,
    data,
    (target as { entity_id?: string } | undefined)?.entity_id,
  ]);

afterEach(() => {
  document.body.replaceChildren();
  setDetailsSheets(undefined);
});

describe('who opens the details', () => {
  const node = document.createElement('div');
  const hass = house();
  // a sheet taken is fetched and opened a moment later: it lands before the page is cleared for the next test
  afterEach(() => wait(30));
  const takes = (id: string, houseSays: Sheets | undefined, own?: Sheets): boolean => {
    document.body.replaceChildren();
    return detailsSheets(() => houseSays)(node, hass, id, own);
  };

  it('takes the kinds with a sheet where the house asks for Fluvy’s, and no other entity', () => {
    for (const id of [
      'light.desk',
      'climate.living',
      'water_heater.tank',
      'humidifier.nursery',
      'cover.blind',
      'valve.garden',
      'media_player.tv',
      'fan.ceiling',
    ])
      expect([id, takes(id, 'fluvy')]).toEqual([id, true]);
    for (const id of ['sensor.outside', 'switch.plug', 'lock.front', 'vacuum.robot', 'lights.x'])
      expect([id, takes(id, 'fluvy')]).toEqual([id, false]);
  });

  it('leaves every entity to Home Assistant where the house keeps its dialog, or nobody says', () => {
    expect(takes('light.desk', 'home-assistant')).toBe(false);
    expect(takes('light.desk', undefined)).toBe(false);
  });

  it('follows the action’s own say over the house’s, either way', () => {
    expect(takes('light.desk', 'home-assistant', 'fluvy')).toBe(true);
    expect(takes('light.desk', 'fluvy', 'home-assistant')).toBe(false);
    // a word it does not know asks for neither: Home Assistant's
    expect(takes('light.desk', 'fluvy', 'ha' as Sheets)).toBe(false);
    // and no action brings a sheet to a kind that has none
    expect(takes('sensor.outside', 'home-assistant', 'fluvy')).toBe(false);
  });

  it('opens the sheet from a card’s more-info, and Home Assistant’s dialog for the rest', async () => {
    setDetailsSheets(detailsSheets(() => 'fluvy'));
    const card = document.createElement('div');
    document.body.append(card);
    const asked: string[] = [];
    card.addEventListener('hass-more-info', (event) =>
      asked.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    const home = house(FLOOR);
    await runAction(card, home, undefined, 'light.floor');
    await runAction(card, home, { action: 'more-info' }, 'sensor.outside');
    await runAction(card, home, { action: 'more-info', details: 'home-assistant' }, 'light.floor');
    await vi.waitFor(() =>
      expect(document.body.querySelector('fluvy-details-light')).not.toBeNull(),
    );
    expect(asked).toEqual(['sensor.outside', 'light.floor']);
  });

  it('never answers a more-info it was not handed: Home Assistant’s own cards keep the dialog', async () => {
    setDetailsSheets(detailsSheets(() => 'fluvy'));
    const theirs = document.createElement('div');
    document.body.append(theirs);
    theirs.dispatchEvent(
      new CustomEvent('hass-more-info', {
        detail: { entityId: 'light.floor' },
        bubbles: true,
        composed: true,
      }),
    );
    await wait(20);
    expect(document.body.querySelector('fluvy-details-light')).toBeNull();
  });
});

describe('a light’s sheet', () => {
  it('heads with the lamp’s name over its state and level, and sets the brightness on the dial', async () => {
    const hass = house(FLOOR);
    const sheet = await docked('fluvy-details-light', FLOOR, hass);
    expect(text(sheet, '.fv-sheet__title')).toBe('Floor lamp');
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('On · 72 %');
    expect([dial(sheet)['value'], dial(sheet)['min'], dial(sheet)['max']]).toEqual([72, 0, 100]);
    turn(sheet, { value: 40 });
    expect(calls(hass)).toEqual([['light.turn_on', { brightness_pct: 40 }, 'light.floor']]);
    // down to nothing is off
    turn(sheet, { value: 0 });
    expect(calls(hass).at(-1)).toEqual(['light.turn_off', {}, 'light.floor']);
  });

  it('switches with its key, and steps from what is on screen, a burst of steps one call', async () => {
    const hass = house(FLOOR);
    const sheet = await docked('fluvy-details-light', FLOOR, hass);
    expect(keyIds(sheet)).toEqual(['down', 'power', 'up']);
    expect(one(sheet, '[data-key="power"]').getAttribute('aria-pressed')).toBe('true');
    press(sheet, 'power');
    expect(calls(hass)).toEqual([['light.turn_off', {}, 'light.floor']]);
    hass.callService.mockClear();
    // each step counts from what is on screen
    for (const key of ['up', 'up', 'down']) {
      step(sheet, key);
      await sheet.updateComplete;
    }
    expect(dial(sheet)['value']).toBe(73);
    expect(calls(hass)).toEqual([]);
    await wait(700);
    expect(calls(hass)).toEqual([['light.turn_on', { brightness_pct: 73 }, 'light.floor']]);
  });

  it('draws the light card’s colours and its effect, each calling the light', async () => {
    const hass = house(FLOOR);
    const sheet = await docked('fluvy-details-light', FLOOR, hass);
    const swatches = [...root(sheet).querySelectorAll<HTMLButtonElement>('button.lc-swatch')];
    expect(swatches).toHaveLength(6);
    swatches[2]!.click();
    expect(calls(hass)).toEqual([['light.turn_on', { rgb_color: [244, 67, 54] }, 'light.floor']]);
    swatches[0]!.click();
    expect(calls(hass).at(-1)?.[1]).toHaveProperty('color_temp_kelvin');
    expect(rowTitles(sheet)).toEqual(['Effect']);
    choose(sheet, 'Effect', 'Candle');
    expect(calls(hass).at(-1)).toEqual(['light.turn_on', { effect: 'Candle' }, 'light.floor']);
  });

  it('is a ring and a switch for a light that only switches, with no effect it does not have', async () => {
    const hass = house(FAIRY);
    const sheet = await docked('fluvy-details-light', FAIRY, hass);
    expect(keyIds(sheet)).toEqual(['power']);
    expect([dial(sheet)['gauge'], dial(sheet)['fill'], dial(sheet)['text']]).toEqual([
      true,
      1,
      'On',
    ]);
    expect(root(sheet).querySelector('.lc-swatches')).toBeNull();
    expect(rowTitles(sheet)).toEqual([]);
    // an effect list without the feature draws no row
    const plain = await docked('fluvy-details-light', {
      ...FLOOR,
      attributes: { ...FLOOR.attributes, supported_features: 0 },
    });
    expect(rowTitles(plain)).toEqual([]);
  });
});

describe('a thermostat’s sheet', () => {
  it('sets a climate’s target on the dial, its mode on a chip and its options in their rows', async () => {
    const hass = house(THERMOSTAT);
    const sheet = await docked('fluvy-details-climate', THERMOSTAT, hass);
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('Heating · 46 % RH');
    expect([
      dial(sheet)['value'],
      dial(sheet)['min'],
      dial(sheet)['max'],
      dial(sheet)['step'],
    ]).toEqual([21.5, 15, 30, 0.5]);
    turn(sheet, { value: 22 });
    expect(calls(hass)).toEqual([
      ['climate.set_temperature', { temperature: 22 }, 'climate.living'],
    ]);
    const chips = [...root(sheet).querySelectorAll<HTMLButtonElement>('.fv-chips .fv-chip')];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Off', 'Heat', 'Cool']);
    chips[2]!.click();
    expect(calls(hass).at(-1)).toEqual([
      'climate.set_hvac_mode',
      { hvac_mode: 'cool' },
      'climate.living',
    ]);
    expect(rowTitles(sheet)).toEqual(['Preset', 'Fan', 'Swing', 'Horizontal swing']);
    choose(sheet, 'Preset', 'eco');
    choose(sheet, 'Fan', 'low');
    choose(sheet, 'Swing', 'vertical');
    choose(sheet, 'Horizontal swing', 'on');
    expect(calls(hass).slice(-4)).toEqual([
      ['climate.set_preset_mode', { preset_mode: 'eco' }, 'climate.living'],
      ['climate.set_fan_mode', { fan_mode: 'low' }, 'climate.living'],
      ['climate.set_swing_mode', { swing_mode: 'vertical' }, 'climate.living'],
      ['climate.set_swing_horizontal_mode', { swing_horizontal_mode: 'on' }, 'climate.living'],
    ]);
  });

  it('steps the target from its keys on the step’s grid, a burst of steps one call', async () => {
    const hass = house(THERMOSTAT);
    const sheet = await docked('fluvy-details-climate', THERMOSTAT, hass);
    expect(keyIds(sheet)).toEqual(['down', 'up']);
    step(sheet, 'up');
    step(sheet, 'up');
    await sheet.updateComplete;
    // shown at once, sent once the taps stop
    expect(dial(sheet)['value']).toBe(22.5);
    expect(calls(hass)).toEqual([]);
    await wait(700);
    expect(calls(hass)).toEqual([
      ['climate.set_temperature', { temperature: 22.5 }, 'climate.living'],
    ]);
  });

  it('sets a range’s two ends, its keys stepping the end the dial moved last', async () => {
    const hass = house(RANGE);
    const sheet = await docked('fluvy-details-climate', RANGE, hass);
    expect([dial(sheet)['low'], dial(sheet)['high']]).toEqual([20, 24]);
    turn(sheet, { low: 20, high: 25 });
    expect(calls(hass)).toEqual([
      ['climate.set_temperature', { target_temp_low: 20, target_temp_high: 25 }, 'climate.study'],
    ]);
    hass.callService.mockClear();
    step(sheet, 'down');
    await wait(700);
    expect(calls(hass)).toEqual([
      ['climate.set_temperature', { target_temp_low: 20, target_temp_high: 23.5 }, 'climate.study'],
    ]);
    // no presets, fan speeds or swing: no rows
    expect(rowTitles(sheet)).toEqual([]);
  });

  it('reads a water heater and a humidifier as the thermostat card does', async () => {
    const tank = house(TANK);
    const heater = await docked('fluvy-details-climate', TANK, tank);
    turn(heater, { value: 55 });
    [...root(heater).querySelectorAll<HTMLButtonElement>('.fv-chips .fv-chip')][2]!.click();
    expect(calls(tank)).toEqual([
      ['water_heater.set_temperature', { temperature: 55 }, 'water_heater.tank'],
      ['water_heater.set_operation_mode', { operation_mode: 'performance' }, 'water_heater.tank'],
    ]);
    const nursery = house(HUMIDIFIER);
    const humidifier = await docked('fluvy-details-climate', HUMIDIFIER, nursery);
    turn(humidifier, { value: 55 });
    [...root(humidifier).querySelectorAll<HTMLButtonElement>('.fv-chips .fv-chip')][0]!.click();
    expect(calls(nursery)).toEqual([
      ['humidifier.set_humidity', { humidity: 55 }, 'humidifier.nursery'],
      ['humidifier.turn_off', {}, 'humidifier.nursery'],
    ]);
  });
});

describe('a cover’s sheet', () => {
  it('sends the cover where the dial says, and runs its commands and its tilt', async () => {
    const hass = house(BLIND);
    const sheet = await docked('fluvy-details-cover', BLIND, hass);
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('Open · 65 %');
    expect(dial(sheet)['value']).toBe(65);
    turn(sheet, { value: 30 });
    expect(keyIds(sheet)).toEqual(['open', 'stop', 'close']);
    press(sheet, 'open');
    press(sheet, 'stop');
    press(sheet, 'close');
    one(sheet, 'fluvy-ruler').dispatchEvent(
      new CustomEvent('fluvy-change', { detail: { value: 20 } }),
    );
    expect(calls(hass)).toEqual([
      ['cover.set_cover_position', { position: 30 }, 'cover.blind'],
      ['cover.open_cover', {}, 'cover.blind'],
      ['cover.stop_cover', {}, 'cover.blind'],
      ['cover.close_cover', {}, 'cover.blind'],
      ['cover.set_cover_tilt_position', { tilt_position: 20 }, 'cover.blind'],
    ]);
  });

  it('draws only what the cover takes: a garage door its ring and two commands, no tilt', async () => {
    const hass = house(GARAGE);
    const sheet = await docked('fluvy-details-cover', GARAGE, hass);
    expect(keyIds(sheet)).toEqual(['open', 'close']);
    expect([dial(sheet)['gauge'], dial(sheet)['fill'], dial(sheet)['text']]).toEqual([
      true,
      0,
      'Closed',
    ]);
    // closed, it has nowhere to close to
    expect(one<HTMLButtonElement>(sheet, '[data-key="close"]').disabled).toBe(true);
    expect(root(sheet).querySelector('fluvy-ruler')).toBeNull();
    // a tilt that only opens and closes is two steps on a row
    const slats = await docked('fluvy-details-cover', {
      ...BLIND,
      attributes: { ...BLIND.attributes, supported_features: 1 | 2 | 16 | 32 },
    });
    expect(rowTitles(slats)).toEqual(['Tilt']);
    expect(root(slats).querySelectorAll('.dt-rows .fv-stepper__half')).toHaveLength(2);
  });

  it('calls a valve by its own services', async () => {
    const hass = house(VALVE);
    const sheet = await docked('fluvy-details-cover', VALVE, hass);
    turn(sheet, { value: 50 });
    press(sheet, 'open');
    expect(calls(hass)).toEqual([
      ['valve.set_valve_position', { position: 50 }, 'valve.garden'],
      ['valve.open_valve', {}, 'valve.garden'],
    ]);
  });
});

describe('a player’s sheet', () => {
  it('heads with the artwork and what plays, and sets the volume on the dial', async () => {
    const hass = house(SPEAKER);
    const sheet = await docked('fluvy-details-media', SPEAKER, hass);
    expect(one<HTMLImageElement>(sheet, '.dt-pic img').getAttribute('src')).toBe(
      'https://ha.example/art.jpg',
    );
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('Weightless · Marconi Union');
    expect(dial(sheet)['value']).toBe(32);
    turn(sheet, { value: 40 });
    expect(calls(hass)).toEqual([
      ['media_player.volume_set', { volume_level: 0.4 }, 'media_player.kitchen'],
    ]);
  });

  it('runs its keys and chooses its source and its sound mode', async () => {
    const hass = house(SPEAKER);
    const sheet = await docked('fluvy-details-media', SPEAKER, hass);
    expect(keyIds(sheet)).toEqual(['power', 'previous', 'play', 'next', 'volume']);
    for (const key of ['previous', 'play', 'next', 'volume', 'power']) press(sheet, key);
    expect(rowTitles(sheet)).toEqual(['Source', 'Sound mode']);
    choose(sheet, 'Source', 'Radio');
    choose(sheet, 'Sound mode', 'Night');
    expect(calls(hass)).toEqual([
      ['media_player.media_previous_track', {}, 'media_player.kitchen'],
      ['media_player.media_play_pause', {}, 'media_player.kitchen'],
      ['media_player.media_next_track', {}, 'media_player.kitchen'],
      ['media_player.volume_mute', { is_volume_muted: true }, 'media_player.kitchen'],
      ['media_player.turn_off', {}, 'media_player.kitchen'],
      ['media_player.select_source', { source: 'Radio' }, 'media_player.kitchen'],
      ['media_player.select_sound_mode', { sound_mode: 'Night' }, 'media_player.kitchen'],
    ]);
  });

  it('draws only what the player takes: one that only plays is its ring and its play key', async () => {
    const sheet = await docked('fluvy-details-media', RADIO);
    expect(keyIds(sheet)).toEqual(['play']);
    expect([dial(sheet)['gauge'], dial(sheet)['text']]).toEqual([true, 'Idle']);
    expect(rowTitles(sheet)).toEqual([]);
    expect(root(sheet).querySelector('.dt-pic')).toBeNull();
  });
});

describe('a fan’s sheet', () => {
  it('sets the speed on the dial in the fan’s own speeds, and steps a speed at a time', async () => {
    const hass = house(CEILING_FAN);
    const sheet = await docked('fluvy-details-fan', CEILING_FAN, hass);
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('On · 67 %');
    expect(dial(sheet)['step']).toBeCloseTo(100 / 3);
    turn(sheet, { value: 33.33 });
    expect(calls(hass)).toEqual([['fan.set_percentage', { percentage: 33 }, 'fan.ceiling']]);
    hass.callService.mockClear();
    step(sheet, 'plus');
    await wait(700);
    expect(calls(hass)).toEqual([['fan.set_percentage', { percentage: 66 }, 'fan.ceiling']]);
  });

  it('switches with its key, and runs its oscillation, its direction and its preset', async () => {
    const hass = house(CEILING_FAN);
    const sheet = await docked('fluvy-details-fan', CEILING_FAN, hass);
    expect(keyIds(sheet)).toEqual(['minus', 'power', 'plus']);
    press(sheet, 'power');
    expect(rowTitles(sheet)).toEqual(['Oscillate', 'Direction', 'Preset']);
    one(sheet, '.dt-rows .fv-hit').click();
    one(sheet, '.dt-rows .fv-row--tap').click();
    choose(sheet, 'Preset', 'sleep');
    expect(calls(hass)).toEqual([
      ['fan.turn_off', {}, 'fan.ceiling'],
      ['fan.oscillate', { oscillating: false }, 'fan.ceiling'],
      ['fan.set_direction', { direction: 'reverse' }, 'fan.ceiling'],
      ['fan.set_preset_mode', { preset_mode: 'sleep' }, 'fan.ceiling'],
    ]);
  });

  it('is a ring and a switch for a fan that only switches', async () => {
    const hass = house(EXTRACTOR);
    const sheet = await docked('fluvy-details-fan', EXTRACTOR, hass);
    expect(keyIds(sheet)).toEqual(['power']);
    expect([dial(sheet)['gauge'], dial(sheet)['fill'], dial(sheet)['text']]).toEqual([
      true,
      0,
      'Off',
    ]);
    expect(rowTitles(sheet)).toEqual([]);
    press(sheet, 'power');
    expect(calls(hass)).toEqual([['fan.turn_on', {}, 'fan.extractor']]);
  });
});

describe('a sheet out of reach', () => {
  const gone = (state: HassEntity): HassEntity => ({ ...state, state: 'unavailable' });
  const anatomy = (sheet: Sheet): unknown => ({
    keys: keyIds(sheet),
    rows: rowTitles(sheet),
    chips: root(sheet).querySelectorAll('.fv-chip').length,
    rulers: root(sheet).querySelectorAll('fluvy-ruler').length,
    day: root(sheet).querySelectorAll('.dt-day').length,
  });

  it.each([
    ['fluvy-details-light', FLOOR],
    ['fluvy-details-climate', THERMOSTAT],
    ['fluvy-details-cover', BLIND],
    ['fluvy-details-media', SPEAKER],
    ['fluvy-details-fan', CEILING_FAN],
  ])('%s keeps its anatomy, every control still', async (tag, state) => {
    const live = await docked(tag, state);
    const hass = house(gone(state));
    const sheet = await docked(tag, gone(state), hass);
    expect(anatomy(sheet)).toEqual(anatomy(live));
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('Unavailable');
    expect(one(sheet, '.dt-body').classList.contains('is-unavailable')).toBe(true);
    expect([dial(sheet)['disabled'], dial(sheet)['text']]).toEqual([true, '—']);
    for (const key of root(sheet).querySelectorAll<HTMLButtonElement>('.dt-keys .fv-action'))
      expect(key.disabled).toBe(true);
    // its head still answers: Home Assistant's own details, and the way out
    for (const round of root(sheet).querySelectorAll<HTMLButtonElement>('.dt-rounds .fv-round'))
      expect(round.disabled).toBe(false);
    expect(calls(hass)).toEqual([]);
  });
});

describe('the sheet as a dialog', () => {
  /** A card as the opener sees one: an element with Home Assistant's `hass`, a button in its own root. */
  function card(hass: House): HTMLElement & { rawHass: HomeAssistant; button: HTMLButtonElement } {
    const element = document.createElement('div') as unknown as HTMLElement & {
      rawHass: HomeAssistant;
      button: HTMLButtonElement;
    };
    element.rawHass = hass;
    element.button = document.createElement('button');
    element.attachShadow({ mode: 'open' }).append(element.button);
    document.body.append(element);
    return element;
  }
  async function opened(state: HassEntity, hass: House = house(state)) {
    const from = card(hass);
    from.button.focus();
    openDetails(from, hass, state.entity_id);
    const sheet = [...document.body.children].find((child) =>
      child.localName.startsWith('fluvy-details-'),
    ) as Sheet;
    await sheet.updateComplete;
    await wait(40);
    return { from, sheet, hass };
  }
  const gone = (): boolean =>
    ![...document.body.children].some((child) => child.localName.startsWith('fluvy-details-'));

  it('opens on the page’s body as a modal dialog named by its entity, the focus on Close', async () => {
    const { sheet } = await opened(FLOOR);
    expect(sheet.parentElement).toBe(document.body);
    const dialog = one<HTMLDialogElement>(sheet, 'dialog');
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('dt-title');
    expect(text(sheet, '#dt-title')).toBe('Floor lamp');
    expect(root(sheet).activeElement?.classList.contains('dt-close')).toBe(true);
  });

  it('closes on Close, on Escape and on its scrim, and gives the focus back to what was tapped', async () => {
    const first = await opened(FLOOR);
    one<HTMLButtonElement>(first.sheet, '.dt-close').click();
    await wait(260);
    expect(gone()).toBe(true);
    expect(first.from.shadowRoot!.activeElement).toBe(first.from.button);

    const second = await opened(FLOOR);
    const cancel = new Event('cancel', { cancelable: true });
    one(second.sheet, 'dialog').dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    await wait(260);
    expect(gone()).toBe(true);

    const third = await opened(FLOOR);
    // a tap inside the sheet is the sheet's; the scrim's own closes, once the opening tap is past
    one(third.sheet, '.fv-sheet').click();
    await wait(400);
    expect(gone()).toBe(false);
    one(third.sheet, 'dialog').click();
    await wait(260);
    expect(gone()).toBe(true);
  });

  it('opens one sheet at a time', async () => {
    await opened(FLOOR);
    await opened(CEILING_FAN, house(FLOOR, CEILING_FAN));
    expect(
      [...document.body.children]
        .map((child) => child.localName)
        .filter((name) => name.startsWith('fluvy-details-')),
    ).toEqual(['fluvy-details-fan']);
  });

  it('follows Home Assistant through the card that opened it', async () => {
    const { from, sheet } = await opened(FLOOR);
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('On · 72 %');
    from.rawHass = house({ ...FLOOR, state: 'off' });
    await wait(60);
    await sheet.updateComplete;
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('Off');
  });

  it('steps aside for Home Assistant’s own details, asked from the card that opened it', async () => {
    const { from, sheet } = await opened(FLOOR);
    const asked: string[] = [];
    from.addEventListener('hass-more-info', (event) =>
      asked.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    one<HTMLButtonElement>(sheet, '.dt-more').click();
    expect(asked).toEqual(['light.floor']);
    expect(gone()).toBe(true);
  });

  it('goes to Fluvy’s History for the entity’s last day, with the way back, and closes', async () => {
    const { sheet } = await opened(FLOOR);
    const pushed = vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    one<HTMLButtonElement>(sheet, '.dt-day .fv-tile__tap').click();
    const path = String(pushed.mock.calls[0]?.[2]);
    pushed.mockRestore();
    expect(path).toMatch(/^\/history\?entity_id=light\.floor&start_date=[^&]+&back=1$/);
    expect(gone()).toBe(true);
  });

  it('goes with the page it was opened on', async () => {
    await opened(FLOOR);
    window.dispatchEvent(new Event('location-changed'));
    expect(gone()).toBe(true);
  });

  it('asks the recorder once for the entity’s day: its states alone, or with what a thermostat measures', async () => {
    const light = await opened(FLOOR);
    expect(light.hass.callWS.mock.calls.map(([message]) => message)).toEqual([
      expect.objectContaining({
        type: 'history/history_during_period',
        entity_ids: ['light.floor'],
        minimal_response: true,
        no_attributes: true,
      }),
    ]);
    const climate = await opened(THERMOSTAT);
    expect(climate.hass.callWS.mock.calls.map(([message]) => message)).toEqual([
      expect.objectContaining({
        entity_ids: ['climate.living'],
        minimal_response: false,
        no_attributes: false,
      }),
    ]);
  });
});
