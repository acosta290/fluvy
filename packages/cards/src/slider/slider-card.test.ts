// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, shownNames } from '../shared/fixtures/editor.js';
import { stateLineWidths } from '../shared/fixtures/widths.js';
import { sliderHeight } from '../slider-family.js';
import { FluvySliderCard } from './slider-card.js';

// the index fetches the lazy families, this card's among them: they land before this file's page goes
beforeAll(() => familiesDefined);

const STAMP = '2026-10-28T08:00:00+00:00';
type Seed = readonly [id: string, state: string, attributes?: Record<string, unknown>];

/** A house with the entities given, and the services each card call sends. */
function house(seeds: readonly Seed[]): {
  readonly hass: HomeAssistant;
  readonly calls: Array<{ service: string; data: unknown; target: unknown }>;
} {
  const calls: Array<{ service: string; data: unknown; target: unknown }> = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: Object.fromEntries(
      seeds.map(([entity_id, state, attributes]) => [
        entity_id,
        {
          entity_id,
          state,
          attributes: { ...attributes },
          last_changed: STAMP,
          last_updated: STAMP,
        },
      ]),
    ),
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callService: (domain: string, service: string, data: unknown, target: unknown) => {
      calls.push({ service: `${domain}.${service}`, data, target });
      return Promise.resolve();
    },
  } as unknown as HomeAssistant;
  return { hass, calls };
}

const SOUNDBAR: Seed = [
  'media_player.soundbar',
  'on',
  {
    friendly_name: 'Soundbar',
    supported_features: 4 | 8,
    volume_level: 0.3,
    is_volume_muted: false,
    source: 'Bluetooth',
  },
];
const OFFSET: Seed = [
  'number.offset',
  '-1',
  { friendly_name: 'Offset', min: -2, max: 2, step: 0.5, unit_of_measurement: '°C' },
];
const PUMP: Seed = [
  'input_number.pump',
  '65',
  { friendly_name: 'Pump', min: 0, max: 100, step: 5, unit_of_measurement: '%' },
];
const POWER: Seed = ['switch.pump', 'off', { friendly_name: 'Pump power' }];
const FAN: Seed = [
  'fan.bedroom',
  'on',
  { friendly_name: 'Fan', percentage: 66, percentage_step: 100 / 3, supported_features: 1 },
];
const EVERYTHING = [SOUNDBAR, OFFSET, PUMP, POWER, FAN];

type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

/** The card drawn for `config` in `hass`, `width` wide where it is given: its shadow root. */
async function draw(
  config: Record<string, unknown>,
  hass: HomeAssistant,
  width?: number,
): Promise<ShadowRoot> {
  const card = document.createElement('fluvy-slider-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-slider-card', ...config });
  card.hass = hass;
  if (width !== undefined) (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  return card.shadowRoot!;
}

const text = (root: ShadowRoot, selector: string): string =>
  root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const labels = (root: ShadowRoot): string[] =>
  [...root.querySelectorAll('.fv-ruler-labels span')].map((span) => span.textContent ?? '');

afterEach(() => {
  document.body.replaceChildren();
});

describe('the Slider card (#77)', () => {
  it('declares the light card’s heights by its config alone: 268 full, 188 compact, 168 as a tile', () => {
    expect(sliderHeight({ type: 'x' })).toBe(268);
    expect(sliderHeight({ type: 'x', variant: 'full' })).toBe(268);
    expect(sliderHeight({ type: 'x', variant: 'compact' })).toBe(188);
    expect(sliderHeight({ type: 'x', variant: 'tile' })).toBe(168);
    expect(FluvySliderCard.layoutHeight({ type: 'x', variant: 'compact' })).toBe(188);
  });

  it('a player’s volume: its mute round in the head, its source on the line, 0–100 % under the ruler', async () => {
    const { hass } = house(EVERYTHING);
    const root = await draw({ entity: 'media_player.soundbar' }, hass);
    expect(root.querySelector('.fv-card__head .fv-round')?.getAttribute('aria-label')).toBe('Mute');
    expect(text(root, '.fv-card__sub')).toBe('Bluetooth');
    expect(text(root, '.fv-readout__value')).toBe('30%');
    expect(labels(root)).toEqual(['0', '25', '50', '75', '100']);
  });

  it('a signed number: the typographic minus and a plus, a tick a step, lit from zero', async () => {
    const { hass } = house(EVERYTHING);
    const root = await draw({ entity: 'number.offset' }, hass);
    expect(text(root, '.fv-readout__value')).toBe('−1.0°C');
    expect(labels(root)).toEqual(['−2', '−1', '0', '+1', '+2']);
    const ruler = root.querySelector('fluvy-ruler')!;
    expect([ruler.origin, ruler.step, ruler.minor, ruler.major]).toEqual([0, 0.5, 1 / 8, 1 / 4]);
    // no control of its own: the head ends in nothing
    expect(root.querySelector('.fv-card__head .fv-round, .fv-card__head .fv-switch')).toBeNull();
  });

  it('another entity’s switch in the head (`toggle_entity`), flipped with its own services', async () => {
    const { hass, calls } = house(EVERYTHING);
    const root = await draw(
      { entity: 'input_number.pump', toggle_entity: 'switch.pump', variant: 'compact' },
      hass,
    );
    const sw = root.querySelector<HTMLElement>('.fv-card__head .fv-switch')!;
    expect(sw.getAttribute('aria-checked')).toBe('false');
    // switched off, the line says so before the figure
    expect(text(root, '.fv-card__sub')).toBe('Off · 65 %');
    (sw.parentElement as HTMLElement).click();
    expect(calls).toEqual([
      { service: 'switch.turn_on', data: {}, target: { entity_id: 'switch.pump' } },
    ]);
  });

  it('a fan: its switch, its speeds as the ruler’s stops and words', async () => {
    const { hass } = house(EVERYTHING);
    const root = await draw({ entity: 'fan.bedroom' }, hass);
    expect(root.querySelector('.fv-card__head .fv-switch')).not.toBeNull();
    expect(labels(root)).toEqual(['Off', 'Low', 'Mid', 'High']);
    const ruler = root.querySelector('fluvy-ruler')!;
    expect(ruler.step).toBeCloseTo(100 / 3);
  });

  it('`control: none` draws no control; `mute` on a number draws none either', async () => {
    const { hass } = house(EVERYTHING);
    const none = await draw({ entity: 'media_player.soundbar', control: 'none' }, hass);
    expect(none.querySelector('.fv-card__head .fv-round')).toBeNull();
    const mute = await draw({ entity: 'number.offset', control: 'mute' }, hass);
    expect(mute.querySelector('.fv-card__head .fv-round')).toBeNull();
  });

  it('its own ends: a soundbar kept under 60 %, a number within its range', async () => {
    const { hass } = house(EVERYTHING);
    const volume = await draw({ entity: 'media_player.soundbar', max: 60 }, hass);
    expect(labels(volume)).toEqual(['0', '15', '30', '45', '60']);
    const pump = await draw({ entity: 'input_number.pump', min: 20, max: 80 }, hass);
    const ruler = pump.querySelector('fluvy-ruler')!;
    expect([ruler.min, ruler.max]).toEqual([20, 80]);
    // ends that make no range are let go: the entity's own
    const odd = await draw({ entity: 'input_number.pump', min: 90, max: 10 }, hass);
    const own = odd.querySelector('fluvy-ruler')!;
    expect([own.min, own.max]).toEqual([0, 100]);
  });

  it('out of reach keeps its size and anatomy: the ban, a dash, the stepper and the round still', async () => {
    const { hass } = house([['media_player.soundbar', 'unavailable', { supported_features: 12 }]]);
    const root = await draw({ entity: 'media_player.soundbar' }, hass);
    expect(root.querySelector('article')!.classList).toContain('is-unavailable');
    expect(text(root, '.fv-readout__value')).toBe('—');
    expect(root.querySelectorAll('fluvy-ruler').length).toBe(1);
    expect(root.querySelector<HTMLButtonElement>('.fv-stepper__half')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.fv-card__head .fv-round')!.disabled).toBe(true);
  });

  it('the mute round sends `volume_mute` and turns at once', async () => {
    const { hass, calls } = house(EVERYTHING);
    const root = await draw({ entity: 'media_player.soundbar' }, hass);
    root.querySelector<HTMLButtonElement>('.fv-card__head .fv-round')!.click();
    expect(calls).toEqual([
      {
        service: 'media_player.volume_mute',
        data: { is_volume_muted: true },
        target: { entity_id: 'media_player.soundbar' },
      },
    ]);
    await (root.host as CardElement).updateComplete;
    expect(root.querySelector('.fv-card__head .fv-round')?.getAttribute('aria-label')).toBe(
      'Unmute',
    );
  });

  it('as a tile: the house’s large tile, its ruler at its foot, the line its compact card’s', async () => {
    const { hass } = house(EVERYTHING);
    const root = await draw({ entity: 'number.offset', variant: 'tile' }, hass);
    expect(root.querySelector('.fv-tile')).not.toBeNull();
    expect(text(root, '.fv-tile__state')).toBe('−1.0 °C');
    expect(root.querySelectorAll('.fv-tile fluvy-ruler').length).toBe(1);
  });

  describe('as a tile, its line keeps its figure: the room or what plays gives way where both do not hold', () => {
    // rooms a 172 tile's line cannot hold beside the figure (by the widths' model), and the figure each language writes
    const ROOM = { en: 'Living room', de: 'Arbeitszimmer', ja: 'リビングルーム' } as const;
    const FIGURE = { en: '−1.0 °C', de: '−1,0 °C', ja: '−1.0 °C' } as const;
    const KITCHEN: Seed = [
      'media_player.kitchen',
      'playing',
      {
        friendly_name: 'Kitchen',
        supported_features: 4 | 8,
        volume_level: 0.45,
        media_title: 'Get Lucky',
      },
    ];
    const speaking = (language: keyof typeof ROOM): HomeAssistant =>
      ({
        ...house([...EVERYTHING, KITCHEN]).hass,
        language,
        locale: { language, number_format: 'language', time_format: '24' },
        entities: { 'number.offset': { entity_id: 'number.offset', area_id: 'room' } },
        areas: { room: { area_id: 'room', name: ROOM[language] } },
      }) as unknown as HomeAssistant;

    let restore: () => void;
    beforeAll(() => {
      restore = stateLineWidths();
    });
    afterAll(() => restore());

    describe.each(['en', 'de', 'ja'] as const)('in %s', (language) => {
      it.each([156, 172])('a number’s tile of %i px says its figure alone', async (width) => {
        const tile = { entity: 'number.offset', variant: 'tile' };
        const root = await draw(tile, speaking(language), width);
        expect(text(root, '.fv-tile__state')).toBe(FIGURE[language]);
      });

      it('a number’s tile of 360 px holds its room and its figure', async () => {
        const root = await draw(
          { entity: 'number.offset', variant: 'tile' },
          speaking(language),
          360,
        );
        expect(text(root, '.fv-tile__state')).toBe(`${ROOM[language]} · ${FIGURE[language]}`);
      });
    });

    it('a player: what plays where it holds, else the volume alone', async () => {
      const tile = { entity: 'media_player.kitchen', variant: 'tile' };
      expect(text(await draw(tile, speaking('en'), 172), '.fv-tile__state')).toBe(
        'Get Lucky · 45 %',
      );
      const long: Seed = [
        KITCHEN[0],
        KITCHEN[1],
        { ...KITCHEN[2], media_title: 'Get Lucky (Radio Edit)' },
      ];
      const hass = { ...speaking('en'), states: house([long]).hass.states } as HomeAssistant;
      expect(text(await draw(tile, hass, 172), '.fv-tile__state')).toBe('45 %');
    });
  });

  describe('its editor offers what acts', () => {
    const shown = async (config: Record<string, unknown>): Promise<string[]> => {
      const editor = await FluvySliderCard.getConfigElement();
      const drawn = await drawEditor(editor, { type: 'custom:fluvy-slider-card', ...config });
      return shownNames(cardForm(drawn).schema);
    };

    it('a player: its ends, the switch of another entity, the stepper of the full card', async () => {
      const fields = await shown({ entity: 'media_player.soundbar' });
      for (const name of ['min', 'max', 'toggle_entity', 'show_stepper', 'show_icon'])
        expect(fields, name).toContain(name);
    });

    it('a fan stops at its speeds: no ends; a tile has no stepper and no circle to hide', async () => {
      expect(await shown({ entity: 'fan.bedroom' })).not.toContain('min');
      const tile = await shown({ entity: 'number.offset', variant: 'tile' });
      expect(tile).not.toContain('show_stepper');
      expect(tile).not.toContain('show_icon');
    });

    it('a control that is not a switch takes no other entity’s', async () => {
      expect(await shown({ entity: 'media_player.soundbar', control: 'mute' })).not.toContain(
        'toggle_entity',
      );
    });
  });
});

describe('the tile card learns the ruler (#77)', () => {
  it('a player’s volume and a number’s value at a large tile’s foot, the number’s figure on its line', async () => {
    const { hass } = house(EVERYTHING);
    const tile = async (entity: string): Promise<ShadowRoot> => {
      const card = document.createElement('fluvy-tile-card') as CardElement;
      card.setConfig({ type: 'custom:fluvy-tile-card', entity });
      card.hass = hass;
      document.body.append(card);
      await card.updateComplete;
      return card.shadowRoot!;
    };
    const player = await tile('media_player.soundbar');
    const volume = player.querySelector('fluvy-ruler')!;
    expect([volume.value, volume.min, volume.max]).toEqual([30, 0, 100]);
    const number = await tile('number.offset');
    const value = number.querySelector('fluvy-ruler')!;
    expect([value.value, value.origin, value.step]).toEqual([-1, 0, 0.5]);
    expect(text(number, '.fv-tile__state')).toBe('−1.0 °C');
    // its reading is on its line, never in its head as well
    expect(number.querySelector('.fv-tile__value')).toBeNull();
  });
});
