// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { roundsRow, roundsRows, type RoundsRowSpec } from './rounds-row.js';
import type { RoundsHost } from './rounds.js';

/*
 * The list row with rounds at its end (1.23): what does not hold beside its words gives way in order — its rounds from
 * the end, then its value, then (every row of the list together) its circle — and the row never stacks: 60 tall, 48
 * compact, whatever its width. Measured with a stub ruler, 8 px a glyph.
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
      state('light.lounge_ceiling', 'on', {
        brightness: 128,
        supported_color_modes: ['brightness'],
      }),
      state('cover.lounge_blinds', 'open', { current_position: 40, supported_features: 15 }),
      state('switch.lounge_fan', 'off'),
    ].map((one) => [one.entity_id, one]),
  ),
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
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
    pill: (_cls, text, pad) => text.length * 8 + pad,
  },
  root: undefined,
};

const ROUNDS = ['light.lounge_ceiling', 'cover.lounge_blinds', 'switch.lounge_fan'].map(
  (entity) => ({ entity }),
);
/** "Lounge" (48) over "21.4° · 48 %", "20.5°" (40) at its end, three rounds after it. */
const LOUNGE: RoundsRowSpec = {
  icon: 'sofa',
  title: 'Lounge',
  sub: '21.4° · 48 %',
  value: '20.5°',
  rounds: ROUNDS,
};

/** The row drawn: its circle, its value, its rounds, its line and its height class. */
function drawn(row = LOUNGE, width = 320, compact = false) {
  const box = document.createElement('div');
  render(roundsRows(host, width, [row], compact), box);
  const element = box.querySelector('.fv-row')!;
  return {
    icon: element.querySelector(':scope > .fv-ico') !== null,
    value: element.querySelector(':scope > .fv-row__value')?.textContent ?? '',
    rounds: [...element.querySelectorAll('.lt-bulb')].map((round) => round.getAttribute('title')),
    sub: element.querySelector('.fv-row__sub')?.textContent ?? '',
    stacked: element.classList.contains('fv-row--stack'),
    compact: element.classList.contains('fv-row--compact'),
  };
}

afterEach(() => document.body.replaceChildren());

describe('a row with rounds at its end (1.23)', () => {
  it('holds its circle, its words, its value and its rounds where the column has room for them all', () => {
    // 56 + 96 (the line) + 12 + 40 (the value) + 12 + 3 × 44 + 2 × 8 = 364
    expect(drawn(LOUNGE, 364)).toEqual({
      icon: true,
      value: '20.5°',
      rounds: ['lounge ceiling', 'lounge blinds', 'lounge fan'],
      sub: '21.4° · 48 %',
      stacked: false,
      compact: false,
    });
    // the line's last segments give way to the rounds before a round goes: the name keeps its own 48
    expect(drawn(LOUNGE, 320)).toMatchObject({
      sub: '21.4°',
      rounds: ROUNDS.map(() => expect.any(String)),
    });
  });

  it('gives its rounds way from the end first, its value staying', () => {
    expect(drawn(LOUNGE, 264)).toMatchObject({
      icon: true,
      value: '20.5°',
      rounds: ['lounge ceiling', 'lounge blinds'],
    });
    expect(drawn(LOUNGE, 212)).toMatchObject({ value: '20.5°', rounds: ['lounge ceiling'] });
    expect(drawn(LOUNGE, 160)).toMatchObject({ icon: true, value: '20.5°', rounds: [] });
  });

  it('then its value, then its circle; its line keeps its first segment, and the row never stacks', () => {
    // the name's 48 and the value's 52 do not hold beside the circle's 56: the value goes
    expect(drawn(LOUNGE, 150)).toMatchObject({ icon: true, value: '', rounds: [], sub: '21.4°' });
    // the name (48) no longer holds beside the circle: every row gives it away, its room the words', and nothing
    // that gave way before it comes back
    expect(drawn(LOUNGE, 100)).toMatchObject({
      icon: false,
      value: '',
      rounds: [],
      sub: '21.4° · 48 %',
      stacked: false,
    });
  });

  it('a long name keeps 96 of itself before anything stays beside it', () => {
    const long = { ...LOUNGE, title: 'The long living room by the garden', sub: undefined };
    // 56 + 96 + 52 + 56: the value and one round
    expect(drawn(long, 260)).toMatchObject({ value: '20.5°', rounds: ['lounge ceiling'] });
    expect(drawn(long, 203)).toMatchObject({ value: '', rounds: [] });
  });

  it('every row of a list gives its circle away together', () => {
    const box = document.createElement('div');
    const short = { ...LOUNGE, title: 'Hall', sub: undefined, value: undefined };
    const long = { ...LOUNGE, title: 'Bedroom', sub: 'Eighteen degrees', value: undefined };
    render(roundsRows(host, 160, [short, long]), box);
    expect(
      [...box.querySelectorAll('.fv-row')].map((row) => row.querySelector(':scope > .fv-ico')),
    ).toEqual([null, null]);
  });

  it('compact: 48 tall, its line gone, its smaller circle', () => {
    const box = document.createElement('div');
    render(roundsRow(host, 320, LOUNGE, { compact: true }), box);
    const row = box.querySelector('.fv-row')!;
    expect(row.classList.contains('fv-row--compact')).toBe(true);
    expect(row.querySelector('.fv-row__sub')).toBeNull();
    expect(row.querySelectorAll('.lt-bulb')).toHaveLength(3);
  });

  it('says its rounds’ states beside their glyphs where they hold, as tall as a round', () => {
    const box = document.createElement('div');
    const said = {
      ...LOUNGE,
      value: undefined,
      rounds: [{ entity: 'cover.lounge_blinds', show_state: true }],
    };
    render(roundsRow(host, 320, said), box);
    const round = box.querySelector('.lt-bulb')!;
    expect(round.classList.contains('lt-bulb--said')).toBe(true);
    expect(round.classList.contains('lt-bulb--under')).toBe(false);
    expect(round.textContent?.trim()).toBe('40 %');
  });
});
