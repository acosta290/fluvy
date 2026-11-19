import type { StateSeed } from '../hass.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';

/*
 * Numbers set in their rows (#218): the bedroom's heating presets as `input_number` helpers (Comfort 21.5 °C, Eco
 * 18 °C, Away 15 °C, Frost 7 °C, 5 to 30 in steps of 0.5), as the issue drew them, on an Entities card — each between
 * − and + (`number_control: stepper`), or a button that opens the decimal keypad (`entry`) — each row its own say
 * beside the card's, a coffee pod counter stepped, a setpoint out of reach, the compact rows, the narrow columns
 * (where the controls give way together to the plain values), and the Helpers card's figures typed (`number_entry`).
 * Light and dark are the page's (`&mode=dark`).
 */

const ENTITIES = 'custom:fluvy-entities-card';
const HELPERS = 'custom:fluvy-helpers-card';

/** A preset of the heating, 5 to 30 °C in steps of 0.5. */
const preset = (id: string, name: string, value: string): StateSeed => [
  `input_number.nb_${id}`,
  value,
  {
    friendly_name: name,
    min: 5,
    max: 30,
    step: 0.5,
    mode: 'box',
    unit_of_measurement: '°C',
  },
];

const COMFORT = { entity: 'input_number.nb_comfort', name: 'Comfort', icon: 'fluvy:sun' };
const ECO = { entity: 'input_number.nb_eco', name: 'Eco', icon: 'fluvy:leaf' };
const AWAY = { entity: 'input_number.nb_away', name: 'Away', icon: 'fluvy:away' };
const FROST = { entity: 'input_number.nb_frost', name: 'Frost', icon: 'fluvy:snow' };

const presets = (more: Record<string, unknown> = {}) => ({
  type: ENTITIES,
  title: 'Heating presets',
  icon: 'fluvy:heater',
  rows: [COMFORT, ECO, AWAY, FROST],
  ...more,
});

/**
 * Half a section each, at the narrow columns too: held to their heights from 172, as at 152 a row's value goes under
 * its words, which a config cannot say (the Entities card's own rule).
 */
const halves = (title: string, cards: readonly Record<string, unknown>[]): FrameSpec => ({
  title,
  heights: [172, 211, 266],
  cards: cards.map((card) => ({ ...(card as { type: string }), cols: 6 })),
});

const STATES: readonly StateSeed[] = [
  preset('comfort', 'Heating comfort', '21.5'),
  preset('eco', 'Heating eco', '18'),
  preset('away', 'Heating away', '15'),
  preset('frost', 'Heating frost', '7'),
  ['input_number.nb_boiler', 'unavailable', { friendly_name: 'Boiler setpoint' }],
  ['counter.nb_coffee_pods', '12', { friendly_name: 'Coffee pods', step: 1, minimum: 0 }],
  [
    'number.nb_dishwasher_delay',
    '3',
    {
      friendly_name: 'Dishwasher start delay',
      min: 0,
      max: 24,
      step: 1,
      mode: 'box',
      unit_of_measurement: 'h',
    },
  ],
];

/** The presets are the bedroom's, as the issue's; the counter and the delay the kitchen's, the boiler the loft's. */
const AREAS: Readonly<Record<string, string>> = {
  nb_bedroom: 'Bedroom',
  nb_kitchen: 'Kitchen',
  nb_loft: 'Loft',
};
const areaOf = (id: string): string =>
  id.startsWith('input_number.nb_boiler')
    ? 'nb_loft'
    : id.startsWith('input_number.')
      ? 'nb_bedroom'
      : 'nb_kitchen';

export const sheet: SheetSpec = {
  states: STATES,
  registry: {
    entities: Object.fromEntries(
      STATES.map(([id]) => [id, { entity_id: id, area_id: areaOf(id) }]),
    ),
    areas: Object.fromEntries(
      Object.entries(AREAS).map(([id, name]) => [id, { area_id: id, name, picture: null }]),
    ),
  },
  frames: [
    {
      title: 'Numbers you can step · heating presets',
      cards: [presets({ number_control: 'stepper' })],
    },
    {
      title: 'Numbers you can type · heating presets',
      cards: [presets({ number_control: 'entry' })],
    },
    {
      title: 'Numbers · each row its own say, a counter stepped',
      cards: [
        {
          type: ENTITIES,
          title: 'Kitchen',
          number_control: 'stepper',
          rows: [
            {
              entity: 'number.nb_dishwasher_delay',
              name: 'Dishwasher delay',
              icon: 'fluvy:clock',
              number_control: 'entry',
            },
            { entity: 'counter.nb_coffee_pods', name: 'Coffee pods', icon: 'fluvy:counter' },
            COMFORT,
            { ...FROST, number_control: 'value' },
          ],
        },
      ],
    },
    {
      title: 'Numbers you can step · compact',
      cards: [presets({ number_control: 'stepper', variant: 'compact' })],
    },
    {
      title: 'Numbers · out of reach, still in their place',
      cards: [
        {
          type: ENTITIES,
          title: 'Boiler',
          rows: [
            { entity: 'input_number.nb_boiler', name: 'Setpoint', number_control: 'stepper' },
            { entity: 'input_number.nb_boiler', name: 'Setpoint typed', number_control: 'entry' },
          ],
        },
      ],
    },
    halves('Numbers · half a section: the plain values where the controls would not hold', [
      presets({ number_control: 'stepper' }),
      presets({ number_control: 'entry' }),
    ]),
    {
      title: 'Helpers · figures you can type',
      cards: [
        {
          type: HELPERS,
          title: 'Heating presets',
          number_entry: true,
          rows: [
            { entity: 'input_number.nb_comfort', name: 'Comfort' },
            { entity: 'input_number.nb_eco', name: 'Eco' },
            { entity: 'counter.nb_coffee_pods', name: 'Coffee pods' },
          ],
        },
      ],
    },
  ],
};
