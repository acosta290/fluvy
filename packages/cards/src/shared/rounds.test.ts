// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import {
  keyStates,
  keyWidth,
  pillWidth,
  roundsAcross,
  statesIn,
  type Round,
  type RoundSpec,
  type RoundsHost,
} from './rounds.js';

/*
 * Where a round says its state (#205, the owner's review of 1.25): the widths a key and a pill take, the ladder a
 * key's words go down in a key the card sets, and rounds across a line. Measured with a stub ruler, 8 px a glyph, a
 * pill on the 4 grid as the card's lays it.
 */

const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) =>
  ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
    last_changed: '',
    last_updated: '',
  }) as HassEntity;

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  config: { unit_system: { temperature: '°C' } },
  states: Object.fromEntries(
    [
      state('switch.gps', 'on'),
      state('sensor.signal', '4'),
      state('sensor.service', '3200', { unit_of_measurement: 'km' }),
      state('binary_sensor.tailgate', 'off', { device_class: 'door' }),
    ].map((one) => [one.entity_id, one]),
  ),
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => ({ on: 'On', off: 'Closed' })[s.state] ?? s.state,
  callService: () => Promise.resolve(),
} as unknown as HomeAssistant;

const host: RoundsHost = {
  hass,
  state: (view) => view.state,
  expect: () => undefined,
  call: () => undefined,
  run: () => undefined,
  tapper: (_of, _at, tap) => tap,
  accent: () => undefined,
  ruler: {
    width: (_cls, text) => text.length * 8,
    pill: (_cls, text, pad) => Math.ceil((text.length * 8 + pad) / 4) * 4,
  },
  root: undefined,
};

/** A round that says `said`, its forms longest first; none: one that says nothing. */
const saying = (...said: string[]): Round =>
  ({ name: 'Round', said: said.length ? said : undefined }) as Round;

const QUICK: RoundSpec[] = [
  'switch.gps',
  'sensor.signal',
  'sensor.service',
  'binary_sensor.tailgate',
].map((entity) => ({ group: 'entity', entity }));

afterEach(() => document.body.replaceChildren());

describe('a round’s key and pill', () => {
  it('a key keeps 12 beside its words on the 4 grid, a pill its glyph’s 40 and 16 after; never narrower than a round', () => {
    expect(pillWidth(host, '21.5 °C', true)).toBe(80);
    expect(pillWidth(host, '21.5 °C', true, 16)).toBe(72);
    expect(pillWidth(host, '21.5 °C', false)).toBe(112);
    expect(pillWidth(host, '—', true)).toBe(44);
    // a key the card sets is as wide as it is tall at the least
    expect(keyWidth(host, 'On')).toBe(64);
    expect(keyWidth(host, '21.5 °C')).toBe(80);
  });

  it('states beside a name hold 12 from their keys’ sides, then 8, then give way from the last', () => {
    const rounds = [saying('21.5 °C', '21.5°'), saying('48 %')];
    // what each adds to its round: 36 and 12 whole; the degree alone 20; 8 from the sides 28 and 4, then 12 and 4
    expect(statesIn(host, rounds, 48, true)).toEqual({ states: ['21.5 °C', '48 %'], sides: 24 });
    expect(statesIn(host, rounds, 47, true)).toEqual({ states: ['21.5°', '48 %'], sides: 24 });
    expect(statesIn(host, rounds, 31, true)).toEqual({ states: ['21.5°', '48 %'], sides: 16 });
    expect(statesIn(host, rounds, 15, true)).toEqual({ states: ['21.5°', undefined], sides: 16 });
    expect(statesIn(host, rounds, 11, true)).toEqual({ states: [], sides: 0 });
    // a pill has one width a state
    expect(statesIn(host, rounds, 112, false)).toEqual({ states: ['21.5 °C', '48 %'], sides: 56 });
    expect(statesIn(host, rounds, 111, false)).toEqual({ states: ['21.5°', '48 %'], sides: 56 });
  });

  it('a key’s words go down their ladder: 12 from its sides, 8, each its own longest, a word cut, a figure never', () => {
    const rounds = [saying('On'), saying('3,200 km'), saying('Closed'), saying()];
    // 64 + 24: every one whole, 12 from its sides; a round that says nothing has no state
    expect(keyStates(host, rounds, 88)).toEqual(['On', '3,200 km', 'Closed', undefined]);
    // 64 + 16: still whole, 8 from them
    expect(keyStates(host, rounds, 80)).toEqual(['On', '3,200 km', 'Closed', undefined]);
    // a figure no side holds is never cut: its glyph alone
    expect(keyStates(host, rounds, 79)).toEqual(['On', '', 'Closed', undefined]);
    // a word no side holds is its key's to cut
    expect(keyStates(host, rounds, 63)).toEqual(['On', '', 'Closed', undefined]);
    // every one in the longest form they all hold in before any side gives
    const readings = [saying('21.5 °C', '21.5°'), saying('1,234.5 hPa', '1,234 hPa')];
    expect(keyStates(host, readings, 112)).toEqual(['21.5 °C', '1,234.5 hPa']);
    expect(keyStates(host, readings, 100)).toEqual(['21.5°', '1,234 hPa']);
    expect(keyStates(host, readings, 90)).toEqual(['21.5°', '1,234 hPa']);
    // …then each its own longest that holds, 12 from the sides before 8
    expect(keyStates(host, readings, 80)).toEqual(['21.5 °C', '']);
    expect(keyStates(host, readings, 79)).toEqual(['21.5°', '']);
    expect(keyStates(host, readings, 56)).toEqual(['21.5°', '']);
    expect(keyStates(host, readings, 55)).toEqual(['', '']);
    // a pill's words stand after its glyph and its 8
    expect(keyStates(host, [saying('Closed')], 100, false)).toEqual(['Closed']);
    expect(keyStates(host, [saying('3,200 km')], 107, false)).toEqual(['']);
  });
});

describe('rounds across a line', () => {
  const across = (width: number, look: RoundsHost['look'] = {}): HTMLElement => {
    const box = document.createElement('div');
    document.body.append(box);
    render(roundsAcross({ ...host, look }, QUICK, width), box);
    return box.firstElementChild as HTMLElement;
  };
  const widths = (line: HTMLElement): string[] =>
    [...line.querySelectorAll<HTMLElement>('.lt-bulb')].map((round) => round.style.width);
  const said = (line: HTMLElement): string[] =>
    [...line.querySelectorAll('.lt-bulb')].map(
      (round) => round.querySelector('.lt-said')?.textContent ?? '(none)',
    );

  it('each in the middle of its share where none says its state, as many as hold 8 apart', () => {
    const line = across(320);
    expect(line.className).toBe('lt-bulbs lt-bulbs--across');
    expect(widths(line)).toEqual(['', '', '', '']);
    expect(said(line)).toEqual(Array(4).fill('(none)'));
    expect(widths(across(140))).toHaveLength(2);
  });

  it('keys that fill the line where one says its state: equal, 8 apart, 64 at the least, by the list and the width alone', () => {
    const line = across(352, { states: true });
    expect(line.className).toBe('lt-bulbs lt-bulbs--keys');
    expect(line.hasAttribute('data-fill-row')).toBe(true);
    expect(widths(line)).toEqual(Array(4).fill('82px'));
    expect(said(line)).toEqual(['On', '4', '3,200 km', 'Closed']);
    // 320: four of 74, "3,200 km" 8 from its key's sides would need 80: its glyph alone, its state still said
    const phone = across(320, { states: true });
    expect(widths(phone)).toEqual(Array(4).fill('74px'));
    expect(said(phone)).toEqual(['On', '4', '', 'Closed']);
    expect(phone.querySelectorAll('.lt-bulb')[2]?.getAttribute('aria-label')).toBe(
      'service, 3,200 km',
    );
    // narrower, those that do not hold give way from the end
    expect(widths(across(226, { states: true }))).toEqual(Array(3).fill('70px'));
    expect(widths(across(136, { states: true }))).toEqual(['64px', '64px']);
    expect(widths(across(120, { states: true }))).toEqual(['120px']);
    // one round's own say makes the line keys, the rest their glyphs alone
    const own = document.createElement('div');
    document.body.append(own);
    render(roundsAcross(host, [{ ...QUICK[0], show_state: true }, ...QUICK.slice(1)], 320), own);
    expect(said(own)).toEqual(['On', '', '', '']);
    // …and a key with no word is marked, so its glyph stands in its middle, never over an empty foot
    expect(
      [...own.querySelectorAll('.lt-bulb')].map((key) => key.classList.contains('lt-bulb--bare')),
    ).toEqual([false, true, true, true]);
  });

  it('keys only where a round the line draws says its state: past the keys it holds, the line is rounds', () => {
    const last = (width: number): HTMLElement => {
      const box = document.createElement('div');
      document.body.append(box);
      render(
        roundsAcross(host, [...QUICK.slice(0, 3), { ...QUICK[3], show_state: true }], width),
        box,
      );
      return box.firstElementChild as HTMLElement;
    };
    // 352 holds four keys: the fourth says its state, the line is keys
    expect(last(352).className).toBe('lt-bulbs lt-bulbs--keys');
    expect(widths(last(352))).toEqual(Array(4).fill('82px'));
    // 226 holds three keys, none of which says anything: the line is rounds in their shares, the four it holds 8
    // apart, no key with no word, and the fourth's state is still a reader's
    expect(last(226).className).toBe('lt-bulbs lt-bulbs--across');
    expect(widths(last(226))).toEqual(['', '', '', '']);
    expect(last(226).querySelector('.lt-bulb--said')).toBeNull();
    expect(last(226).querySelectorAll('.lt-bulb')[3]?.getAttribute('aria-label')).toContain(', ');
    // 140 holds two rounds of the four: those that do not hold give way from the end
    expect(widths(last(140))).toEqual(['', '']);
  });

  it('pills beside their glyphs: 96 at the least, their words in their middle', () => {
    const line = across(320, { states: true, beside: true });
    expect(widths(line)).toEqual(Array(3).fill('101px'));
    expect(said(line)).toEqual(['On', '4', '']);
    expect(line.querySelector('.lt-bulb--under')).toBeNull();
  });
});
