import { wallClock, type HomeAssistant } from '@fluvy/core';
import { html, type PropertyValues, type TemplateResult } from 'lit';
import { buildHeating, type Heating } from '../../../../packages/cards/src/schedule/automation.js';
import {
  blockAt,
  DAYS,
  helperDays,
  helperOf,
  type Block,
  type Week,
} from '../../../../packages/cards/src/schedule/plan.js';
import { presetLooks } from '../../../../packages/cards/src/schedule/presets.js';
import { FluvyScheduleCard } from '../../../../packages/cards/src/schedule/schedule-card.js';
import {
  FluvyHeatingSheet,
  type HeatingRequest,
} from '../../../../packages/cards/src/schedule/sheet/heating-sheet.js';
import { Card } from '../../../../packages/cards/src/shared/base.js';
import type { MockHouse } from '../hass.js';
import { NOW } from '../now.js';
import type { SheetSpec } from '../scenes.js';
import type { WsTable } from '../ws.js';

/**
 * The Heating schedule card (#229): Marta's bedroom on Home Assistant's own schedule helper, as the issue drew it —
 * Comfort on workday mornings and evenings and all of the weekend, Eco between, Away for when the house is empty; the
 * living room's week of four presets, one of them its own; the kids' room with no schedule yet; the attic's
 * thermostat out of reach; the study's helper kept in YAML; the hall's automation edited by hand in Home Assistant.
 * Home Assistant is answered here, in memory: the helpers' collection (`schedule/subscribe`, `create`, `update`,
 * `delete`), the registry's tie of a helper to its entity, a YAML schedule's week (`schedule.get_schedule`), what an
 * entity and an automation relate to (`search/related`) and the automations' config API, so a plan saved from the
 * sheet is written as Home Assistant would take it (every message and body recorded for the interactions suite).
 */

const LATENCY = 140;
const ZONE = 'Europe/Madrid';

const minutes = (at: string): number => {
  const [h = 0, m = 0] = at.split(':').map(Number);
  return h * 60 + m;
};
/** Blocks of one preset, by their times ('06:00-08:00'). */
const blocks = (preset: string, ...spans: string[]): Block[] =>
  spans.map((span) => {
    const [from = '', to = ''] = span.split('-');
    return { from: minutes(from), to: minutes(to), preset };
  });
const week = (
  workday: readonly Block[],
  weekend: readonly Block[],
  own: Partial<Week> = {},
): Week =>
  Object.fromEntries(
    DAYS.map((day) => [
      day,
      own[day] ?? (day === 'saturday' || day === 'sunday' ? weekend : workday),
    ]),
  ) as unknown as Week;

/** The bedroom as the issue drew it: Comfort 06:00–08:00 and 17:00–22:00 on workdays, 08:00–22:00 at the weekend. */
const BEDROOM_WEEK = week(
  blocks('comfort', '06:00-08:00', '17:00-22:00'),
  blocks('comfort', '08:00-22:00'),
);
/** The living room: a reading lamp's Sunday afternoon, the nights in Sleep. */
const LIVING_WEEK = week(
  [...blocks('comfort', '06:30-08:30', '17:30-22:30'), ...blocks('sleep', '22:30-24:00')],
  [
    ...blocks('comfort', '08:00-13:00'),
    ...blocks('Reading', '13:00-17:00'),
    ...blocks('comfort', '17:00-23:00'),
  ],
);
const ATTIC_WEEK = week(blocks('comfort', '18:00-21:00'), blocks('comfort', '10:00-18:00'));
/** The study's, kept in YAML (its blocks' `data` written by hand): workdays only. */
const STUDY_WEEK = week(blocks('comfort', '08:00-12:00', '14:00-18:00'), []);
const HALL_WEEK = week(
  blocks('comfort', '07:00-09:00', '18:00-21:00'),
  blocks('comfort', '09:00-21:00'),
);

const COMFORT = { key: 'comfort', name: 'Comfort', temperature: 21 } as const;
const ECO = { key: 'eco', name: 'Eco', temperature: 18 } as const;
const AWAY = { key: 'away', name: 'Away', temperature: 16 } as const;

const plan = (
  id: string,
  room: string,
  schedule: string,
  climate: string,
  presets: Heating['presets'],
  base = 'eco',
): Heating => ({
  id,
  alias: `Heating schedule · ${room}`,
  description: `Written by Fluvy’s Heating schedule card: it sets ${room} radiator by the times of ${room} heating. Change it in the card: edited here, the card shows it but no longer changes it.`,
  schedule,
  climate,
  presets,
  base,
});

const BEDROOM = plan(
  'fluvy_b3d7a0c1e2f4',
  'Bedroom',
  'schedule.bedroom_heating',
  'climate.bedroom_radiator',
  [ECO, COMFORT, AWAY],
);
const LIVING = plan(
  'fluvy_1e2d3c4b5a69',
  'Living room',
  'schedule.living_room_heating',
  'climate.living_room',
  [
    COMFORT,
    ECO,
    { key: 'sleep', name: 'Sleep', temperature: 17.5 },
    { key: 'Reading', name: 'Reading', temperature: 22.5 },
  ],
);
const ATTIC = plan('fluvy_a77c1c0ffee1', 'Attic', 'schedule.attic_heating', 'climate.attic', [
  COMFORT,
  ECO,
]);
const STUDY = plan('fluvy_5d0d5d0d5d00', 'Study', 'schedule.study_heating', 'climate.study', [
  COMFORT,
  ECO,
]);
const HALL = plan('fluvy_4a114a114a11', 'Hall', 'schedule.hall_heating', 'climate.hall', [
  COMFORT,
  ECO,
]);

/** The hall's automation as someone left it in Home Assistant's editor: a template where a figure was. */
const HALL_EDITED = (() => {
  const built = buildHeating(HALL) as unknown as Record<string, unknown>;
  const actions = structuredClone(built['actions']) as Array<{ default: Array<{ data: object }> }>;
  const first = actions[0]?.default[0];
  if (first) first.data = { temperature: '{{ states("input_number.hall_eco") }}' };
  return { ...built, actions };
})();

/* ---------- Home Assistant, in memory ---------- */

/** The helpers' collection, by id. */
const helpers = new Map<string, Record<string, unknown>>(
  [
    ['bedroom_heating', 'Bedroom heating', BEDROOM_WEEK],
    ['living_room_heating', 'Living room heating', LIVING_WEEK],
    ['attic_heating', 'Attic heating', ATTIC_WEEK],
    ['hall_heating', 'Hall heating', HALL_WEEK],
  ].map(([id, name, plan]) => [
    id as string,
    { id, name, icon: 'mdi:calendar-clock', ...helperDays(plan as Week) },
  ]),
);
/** A YAML schedule's week, as `get_schedule` answers it: the day's end as Python writes `time.max`. */
const yaml = new Map<string, Week>([['schedule.study_heating', STUDY_WEEK]]);
/** The automations' configs, by id. */
const configs = new Map<string, object>([
  [BEDROOM.id, buildHeating(BEDROOM)],
  [LIVING.id, buildHeating(LIVING)],
  [ATTIC.id, buildHeating(ATTIC)],
  [STUDY.id, buildHeating(STUDY)],
  [HALL.id, HALL_EDITED],
]);

/** The time it is on the sheets' clock in the house's zone: the day, and the minute of it. */
const wall = wallClock(NOW, ZONE);
const today =
  DAYS[(new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay() + 6) % 7] ?? 'monday';
const minute = wall.hour * 60 + wall.minute;

/** A helper's entity as Home Assistant writes it now: on in a block, its data as attributes, off between. */
const helperState = (
  name: string,
  plan: Week,
  editable = true,
): [string, Record<string, unknown>] => {
  const block = blockAt(plan, today, minute);
  return [
    block ? 'on' : 'off',
    {
      friendly_name: name,
      icon: 'mdi:calendar-clock',
      editable,
      ...(block?.preset ? { preset: block.preset } : {}),
    },
  ];
};

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** The automation entity whose config has that id, in the house as it is now. */
const entityOf = (house: MockHouse | undefined, id: string): string | undefined =>
  Object.values(house?.hass().states ?? {}).find(
    (entity) => entity.entity_id.startsWith('automation.') && entity.attributes['id'] === id,
  )?.entity_id;

/** What Home Assistant's frontend rejects a socket call with. */
const refused = (code: string, message: string): never => {
  throw { code, message };
};

const answerOf = (id: string): Record<string, unknown> => ({ ...helpers.get(id) });

/** A socket message's fields but those it was sent with (its type, its number, the helper it names). */
const without = (message: Record<string, unknown>, ...keys: string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(message).filter(([key]) => !keys.includes(key)));

/** Home Assistant's time as `get_schedule` serialises one: seconds, and the day's end as `time.max`. */
const served = (plan: Week): Record<string, unknown> =>
  Object.fromEntries(
    DAYS.map((day) => [
      day,
      helperDays(plan)[day].map((block) => ({
        ...block,
        to: block.to === '24:00:00' ? '23:59:59.999999' : block.to,
      })),
    ]),
  );

const ws: WsTable = {
  'schedule/subscribe': () =>
    [...helpers.keys()].map((id) => ({
      change_type: 'added',
      schedule_id: id,
      item: answerOf(id),
    })),
  'schedule/create': (message, house) => {
    const item = without(message, 'type', 'id');
    const id = slug(String(item['name']));
    if (!helperOf({ id, ...item }))
      return refused('invalid_format', 'Overlapping times found in schedule');
    helpers.set(id, { id, ...item });
    house?.add([`schedule.${id}`, 'off', { friendly_name: item['name'], editable: true }]);
    return answerOf(id);
  },
  'schedule/update': (message, house) => {
    const id = message['schedule_id'];
    const item = without(message, 'type', 'id', 'schedule_id');
    if (typeof id !== 'string' || !helpers.has(id))
      return refused('not_found', `Unable to find schedule_id ${String(id)}`);
    helpers.set(id, { id, ...item });
    house?.set(`schedule.${id}`, undefined, { friendly_name: item['name'] });
    return answerOf(id);
  },
  'schedule/delete': (message, house) => {
    const id = String(message['schedule_id']);
    helpers.delete(id);
    house?.remove(`schedule.${id}`);
    return null;
  },
  // a schedule entity's registry entry (a helper's, made here too: its entity is named by its id); the YAML one's key
  'config/entity_registry/get': (message) => {
    const entity = String(message['entity_id']);
    const id = entity.slice('schedule.'.length);
    if (!entity.startsWith('schedule.')) return undefined;
    if (!helpers.has(id) && !yaml.has(entity)) return refused('not_found', 'Entity not found');
    return { entity_id: entity, platform: 'schedule', unique_id: id };
  },
  call_service: (message) => {
    if (message['domain'] !== 'schedule' || message['service'] !== 'get_schedule') return undefined;
    const entity = String((message['target'] as { entity_id?: unknown } | undefined)?.entity_id);
    const own = yaml.get(entity);
    return own ? { context: { id: 'ctx' }, response: { [entity]: served(own) } } : undefined;
  },
  // an entity's automations (those whose config names it); an automation's entities (those its config names)
  'search/related': (message, house) => {
    const id = String(message['item_id']);
    if (message['item_type'] === 'automation') {
      const configId = house?.hass().states[id]?.attributes['id'];
      const config = typeof configId === 'string' ? configs.get(configId) : undefined;
      if (!config) return undefined;
      const named = JSON.stringify(config).match(/"(climate|schedule)\.[a-z0-9_]+"/g) ?? [];
      return { entity: [...new Set(named.map((text) => text.slice(1, -1)))] };
    }
    if (message['item_type'] !== 'entity') return undefined;
    const named = [...configs]
      .filter(([, config]) => JSON.stringify(config).includes(`"${id}"`))
      .flatMap(([configId]) => entityOf(house, configId) ?? []);
    return named.length ? { automation: named } : undefined;
  },
};

const PATH = /^config\/automation\/config\/(fluvy_[0-9a-f]{12})$/;

/** The automations' config API for the heating plans: the house follows what is written, a beat later. */
function api(method: string, path: string, body?: unknown, house?: MockHouse): unknown {
  const id = PATH.exec(path)?.[1];
  if (!id || (!configs.has(id) && method !== 'POST')) return undefined;
  if (method === 'GET') return structuredClone(configs.get(id));
  if (method !== 'POST') return undefined;
  const config = (body ?? {}) as Record<string, unknown>;
  const alias = String(config['alias'] ?? 'Heating schedule');
  configs.set(id, structuredClone(config));
  setTimeout(() => {
    if (!house) return;
    const existing = entityOf(house, id);
    if (existing) house.set(existing, undefined, { friendly_name: alias, id });
    else
      house.add([
        `automation.${slug(alias)}`,
        'on',
        { friendly_name: alias, id, last_triggered: null, mode: 'restart', current: 0 },
      ]);
    house.fire('automation_reloaded');
  }, LATENCY);
  return { result: 'ok' };
}

/* ---------- the house ---------- */

const RADIATOR = {
  min_temp: 7,
  max_temp: 30,
  target_temp_step: 0.5,
  hvac_modes: ['off', 'heat'],
  supported_features: 1 | 16,
  preset_modes: ['none', 'eco', 'comfort', 'away', 'boost'],
};

const automation = (heating: Heating, state = 'on'): [string, string, Record<string, unknown>] => [
  `automation.${slug(heating.alias)}`,
  state,
  {
    friendly_name: heating.alias,
    id: heating.id,
    last_triggered: new Date(NOW.getTime() - 4 * 3600_000).toISOString(),
    mode: 'restart',
    current: 0,
  },
];

/** The guest's house: the house's connection copied once, so the guest's card keeps stores of its own. */
const guestConnections = new WeakMap<object, HomeAssistant['connection']>();
const guest = (hass: HomeAssistant): HomeAssistant => {
  let connection = guestConnections.get(hass.connection);
  if (!connection) guestConnections.set(hass.connection, (connection = { ...hass.connection }));
  return {
    ...hass,
    user: { ...hass.user, is_admin: false },
    connection,
    // a guest never reads a config: a call here is a bug, and the suite looks for it
    callApi: async (method: string, path: string) => {
      const window_ = window as unknown as { __guestApi?: string[] };
      (window_.__guestApi ??= []).push(`${method} ${path}`);
      throw new Error('a guest may not read configs');
    },
  } as HomeAssistant;
};

/* ---------- the sheet, docked ---------- */

/**
 * The heating sheet is a modal in production. Here it is docked into a frame, as the schedule sheet's is, so it can
 * be photographed and measured: the bedroom's Monday being edited (`edit`), a new plan for the kids' room (`new`), the
 * living room's read by a guest (`read`). Saving here writes nothing.
 */
class HeatingDemo extends Card {
  protected renderCard(): TemplateResult {
    return html`<fluvy-heating-sheet
      docked
      ?dark=${this.dark}
      ?no-theme=${this.noTheme}
      .hass=${this.hass}
    ></fluvy-heating-sheet>`;
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    const sheet = this.renderRoot.querySelector<FluvyHeatingSheet>('fluvy-heating-sheet');
    if (!sheet) return;
    const mode = this.config?.['mode'];
    const common: Omit<HeatingRequest, 'room' | 'climate'> = {
      day: 'monday',
      days: DAYS,
      unit: { min: 7, max: 30, step: 0.5, unit: '°C', range: false, modes: RADIATOR.preset_modes },
      looks: (presets) => presetLooks(this.hass, undefined, presets),
      save: async () => undefined,
    };
    if (mode === 'new') {
      sheet.open({ ...common, room: 'Kids’ room', climate: 'climate.kids_room' });
      return;
    }
    const heating = mode === 'read' ? LIVING : BEDROOM;
    sheet.open({
      ...common,
      room: mode === 'read' ? 'Living room' : 'Bedroom',
      climate: heating.climate,
      week: mode === 'read' ? LIVING_WEEK : BEDROOM_WEEK,
      presets: heating.presets,
      base: heating.base,
      ...(mode === 'read' ? { readOnly: 'guest' as const, day: today } : {}),
    });
  }
}

const define = (tag: string, ctor: CustomElementConstructor): void => {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
};
// its chunk lands after the page has drawn: the sheet defines the card from its module, as the web sheet does
define('fluvy-schedule-card', FluvyScheduleCard);
define('fluvy-heating-sheet', FluvyHeatingSheet);
define('pg-heating-demo', HeatingDemo);

const CARD = 'custom:fluvy-schedule-card';
const frozen = { _now: NOW.toISOString() };

export const sheet: SheetSpec = {
  states: [
    [
      'climate.bedroom_radiator',
      'heat',
      {
        friendly_name: 'Bedroom radiator',
        ...RADIATOR,
        temperature: 21,
        current_temperature: 20.6,
        hvac_action: 'heating',
        preset_mode: 'comfort',
      },
    ],
    [
      'climate.living_room',
      'heat',
      {
        friendly_name: 'Living room thermostat',
        ...RADIATOR,
        preset_modes: undefined,
        supported_features: 1,
        temperature: 21,
        current_temperature: 21.3,
        hvac_action: 'idle',
      },
    ],
    [
      'climate.kids_room',
      'heat',
      {
        friendly_name: 'Kids’ room radiator',
        ...RADIATOR,
        temperature: 19,
        current_temperature: 18.7,
        hvac_action: 'heating',
      },
    ],
    ['climate.attic', 'unavailable', { friendly_name: 'Attic radiator', ...RADIATOR }],
    [
      'climate.study',
      'heat',
      {
        friendly_name: 'Study radiator',
        ...RADIATOR,
        temperature: 18,
        current_temperature: 18.4,
        hvac_action: 'idle',
      },
    ],
    [
      'climate.hall',
      'heat',
      {
        friendly_name: 'Hall radiator',
        ...RADIATOR,
        temperature: 18,
        current_temperature: 17.9,
        hvac_action: 'idle',
      },
    ],
    ['schedule.bedroom_heating', ...helperState('Bedroom heating', BEDROOM_WEEK)],
    ['schedule.living_room_heating', ...helperState('Living room heating', LIVING_WEEK)],
    ['schedule.attic_heating', ...helperState('Attic heating', ATTIC_WEEK)],
    ['schedule.study_heating', ...helperState('Study heating', STUDY_WEEK, false)],
    ['schedule.hall_heating', ...helperState('Hall heating', HALL_WEEK)],
    automation(BEDROOM),
    automation(LIVING),
    automation(ATTIC),
    automation(STUDY),
    automation(HALL),
  ],
  registry: {
    entities: Object.fromEntries(
      [
        ['climate.bedroom_radiator', 'hs_bedroom'],
        ['climate.living_room', 'hs_living'],
        ['climate.kids_room', 'hs_kids'],
        ['climate.attic', 'hs_attic'],
        ['climate.study', 'hs_study'],
        ['climate.hall', 'hs_hall'],
      ].map(([id, area]) => [id, { entity_id: id, area_id: area }]),
    ),
    areas: {
      hs_bedroom: { area_id: 'hs_bedroom', name: 'Bedroom' },
      hs_living: { area_id: 'hs_living', name: 'Living room' },
      hs_kids: { area_id: 'hs_kids', name: 'Kids’ room' },
      hs_attic: { area_id: 'hs_attic', name: 'Attic' },
      hs_study: { area_id: 'hs_study', name: 'Study' },
      hs_hall: { area_id: 'hs_hall', name: 'Hall' },
    },
  },
  ws,
  api,
  frames: [
    {
      title: 'Bedroom heating plan',
      cards: [{ type: CARD, entity: 'climate.bedroom_radiator', ...frozen }],
    },
    {
      title: 'Today · half',
      heights: [152, 172, 211, 266],
      cards: [
        { type: CARD, entity: 'climate.bedroom_radiator', variant: 'today', cols: 6, ...frozen },
        { type: CARD, entity: 'climate.living_room', variant: 'today', cols: 6, ...frozen },
      ],
    },
    {
      title: 'Living room · four presets',
      cards: [
        {
          type: CARD,
          entity: 'climate.living_room',
          presets: [{ preset: 'Reading', icon: 'mdi:book-open-variant', tone: 'solar' }],
          ...frozen,
        },
      ],
    },
    {
      title: 'Week · half',
      heights: [152, 172, 211, 266],
      cards: [
        { type: CARD, entity: 'climate.bedroom_radiator', cols: 6, ...frozen },
        { type: CARD, entity: 'climate.living_room', show_head: false, cols: 6, ...frozen },
      ],
    },
    { title: 'No schedule yet', cards: [{ type: CARD, entity: 'climate.kids_room', ...frozen }] },
    {
      title: 'No schedule yet · today',
      cards: [{ type: CARD, entity: 'climate.kids_room', variant: 'today', ...frozen }],
    },
    {
      title: 'Guest',
      cards: [{ type: CARD, entity: 'climate.bedroom_radiator', ...frozen }],
      hass: guest,
    },
    {
      title: 'Guest · no schedule',
      cards: [{ type: CARD, entity: 'climate.kids_room', ...frozen }],
      hass: guest,
    },
    { title: 'Out of reach', cards: [{ type: CARD, entity: 'climate.attic', ...frozen }] },
    { title: 'Kept in YAML', cards: [{ type: CARD, entity: 'climate.study', ...frozen }] },
    {
      title: 'Edited in Home Assistant',
      cards: [{ type: CARD, entity: 'climate.hall', ...frozen }],
    },
    {
      title: 'Sunday first · no legend',
      cards: [
        {
          type: CARD,
          entity: 'climate.bedroom_radiator',
          first_weekday: 'sunday',
          show_presets: false,
          ...frozen,
        },
      ],
    },
    {
      title: 'Sheet · edit',
      width: 392,
      cards: [{ type: 'custom:pg-heating-demo', mode: 'edit' }],
    },
    { title: 'Sheet · new', width: 392, cards: [{ type: 'custom:pg-heating-demo', mode: 'new' }] },
    {
      title: 'Sheet · read',
      width: 392,
      cards: [{ type: 'custom:pg-heating-demo', mode: 'read' }],
    },
  ],
};
