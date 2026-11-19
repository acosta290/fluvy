// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import { scheduleHeight } from '../schedule-family.js';
import { TextRuler } from '../shared/fit.js';
import { cardForm, drawEditor, shownNames } from '../shared/fixtures/editor.js';
import { buildHeating, parseHeating, type Heating } from './automation.js';
import { helperDays, startWeek, withDay, type Week } from './plan.js';
import { FluvyScheduleCard, type ScheduleCardConfig } from './schedule-card.js';
import type { FluvyHeatingSheet } from './sheet/heating-sheet.js';

// the card's chunk lands with the index (its English first)
await familiesDefined;

/** Thursday 17 September 2026, 21:47 in Madrid: Comfort until 22:30 on the start week. */
const NOW = '2026-09-17T19:47:00Z';

const BEDROOM: Heating = {
  id: 'fluvy_b3d7a0c1e2f4',
  alias: 'Heating schedule · Bedroom',
  schedule: 'schedule.bedroom_heating',
  climate: 'climate.bedroom',
  presets: [
    { key: 'comfort', name: 'Comfort', temperature: 21 },
    { key: 'eco', name: 'Eco', temperature: 18 },
    { key: 'away', name: 'Away', temperature: 16 },
  ],
  base: 'eco',
};
const WEEK = startWeek('comfort');
const STUDY_WEEK: Week = withDay(startWeek('comfort'), 'sunday', []);

const entity = (
  entity_id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity => ({
  entity_id,
  state,
  attributes: { friendly_name: entity_id, ...attributes },
  last_changed: '',
  last_updated: '',
});

const RADIATOR = { min_temp: 7, max_temp: 30, target_temp_step: 0.5, supported_features: 17 };
const STATES: Record<string, HassEntity> = {
  'climate.bedroom': entity('climate.bedroom', 'heat', {
    ...RADIATOR,
    friendly_name: 'Bedroom radiator',
    temperature: 21,
    current_temperature: 20.6,
    hvac_action: 'heating',
  }),
  'climate.kids': entity('climate.kids', 'heat', {
    ...RADIATOR,
    friendly_name: 'Kids radiator',
    temperature: 19,
  }),
  'climate.study': entity('climate.study', 'heat', {
    ...RADIATOR,
    friendly_name: 'Study radiator',
    temperature: 18,
  }),
  'climate.attic': entity('climate.attic', 'unavailable', {
    ...RADIATOR,
    friendly_name: 'Attic radiator',
  }),
  'schedule.bedroom_heating': entity('schedule.bedroom_heating', 'on', {
    preset: 'comfort',
    editable: true,
  }),
  'schedule.study': entity('schedule.study', 'off', { editable: false }),
  'automation.heating_bedroom': entity('automation.heating_bedroom', 'on', {
    friendly_name: BEDROOM.alias,
    id: BEDROOM.id,
  }),
};

interface Fixture {
  hass: HomeAssistant;
  callApi: ReturnType<typeof vi.fn>;
  callService: ReturnType<typeof vi.fn>;
  callWS: ReturnType<typeof vi.fn>;
  configs: Map<string, unknown>;
}

/**
 * A house on a connection of its own: Home Assistant's helpers' collection (the bedroom's, made in its interface), the
 * study's YAML schedule answered by `get_schedule`, the registry's tie of each schedule to its helper, `search/related`
 * from the configs, and the config API (`refuse`: a POST refused as Home Assistant refuses one).
 */
function house(
  options: { admin?: boolean; states?: Record<string, HassEntity>; refuse?: boolean } = {},
): Fixture {
  const configs = new Map<string, unknown>([[BEDROOM.id, buildHeating(BEDROOM)]]);
  const items = new Map<string, Record<string, unknown>>([
    [
      'bedroom_heating',
      {
        id: 'bedroom_heating',
        name: 'Bedroom heating',
        icon: 'mdi:calendar-clock',
        ...helperDays(WEEK),
      },
    ],
  ]);
  const states = options.states ?? STATES;
  /** A message as the socket carries it, its fields read loosely. */
  const without = (message: Record<string, unknown>, ...keys: string[]): Record<string, unknown> =>
    Object.fromEntries(Object.entries(message).filter(([key]) => !keys.includes(key)));
  const callWS = vi.fn(async (message: Record<string, unknown>) => {
    switch (message['type']) {
      case 'search/related': {
        if (message['item_type'] === 'automation')
          return { entity: ['climate.bedroom', 'schedule.bedroom_heating'] };
        const id = message['item_id'];
        return {
          automation: [...configs]
            .filter(([, config]) => JSON.stringify(config).includes(`"${id}"`))
            .flatMap(([configId]) =>
              Object.values(states)
                .filter((each) => each.attributes['id'] === configId)
                .map((each) => each.entity_id),
            ),
        };
      }
      case 'config/entity_registry/get': {
        const unique = { 'schedule.bedroom_heating': 'bedroom_heating', 'schedule.study': 'study' }[
          message['entity_id'] as string
        ];
        if (unique) return { unique_id: unique, platform: 'schedule' };
        if (items.has(String(message['entity_id']).slice(9)))
          return { unique_id: String(message['entity_id']).slice(9), platform: 'schedule' };
        throw { code: 'not_found', message: 'Entity not found' };
      }
      case 'call_service':
        return { response: { 'schedule.study': helperDays(STUDY_WEEK) } };
      case 'schedule/create': {
        const item = without(message, 'type');
        const id = 'kids_room_heating';
        items.set(id, { id, ...item });
        return { id, ...item };
      }
      case 'schedule/update': {
        const id = String(message['schedule_id']);
        const item = without(message, 'type', 'schedule_id');
        items.set(id, { id, ...item });
        return { id, ...item };
      }
      case 'schedule/delete':
        items.delete(String(message['schedule_id']));
        return null;
    }
    throw new Error(`unanswered ${message['type']}`);
  });
  const callApi = vi.fn(async (method: string, path: string, body?: unknown) => {
    const id = path.slice(path.lastIndexOf('/') + 1);
    if (method === 'POST') {
      if (options.refuse)
        throw {
          error: 'Response error: 400',
          status_code: 400,
          body: { message: 'Message malformed' },
        };
      configs.set(id, body);
      return { result: 'ok' };
    }
    const config = configs.get(id);
    if (config) return structuredClone(config);
    throw { error: 'Response error: 404', status_code: 404, body: { message: 'not found' } };
  });
  const callService = vi.fn(async () => undefined);
  const hass = {
    language: 'en',
    locale: {
      language: 'en',
      number_format: 'language',
      time_format: '24',
      first_weekday: 'monday',
      time_zone: 'server',
    },
    states,
    entities: {
      'climate.bedroom': { entity_id: 'climate.bedroom', area_id: 'bedroom' },
      'climate.kids': { entity_id: 'climate.kids', area_id: 'kids' },
    },
    devices: {},
    areas: {
      bedroom: { area_id: 'bedroom', name: 'Bedroom' },
      kids: { area_id: 'kids', name: 'Kids’ room' },
    },
    config: { unit_system: { temperature: '°C', length: 'km' }, time_zone: 'Europe/Madrid' },
    user: { id: 'u1', name: 'Marta', is_admin: options.admin ?? true },
    connection: {
      subscribeMessage: vi.fn(
        async (callback: (event: unknown) => void, message: { type: string }) => {
          if (message.type === 'schedule/subscribe')
            queueMicrotask(() =>
              callback(
                [...items.values()].map((item) => ({
                  change_type: 'added',
                  schedule_id: item['id'],
                  item,
                })),
              ),
            );
          return () => undefined;
        },
      ),
    },
    callApi,
    callService,
    callWS,
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
  } as unknown as HomeAssistant;
  return { hass, callApi, callService, callWS, configs };
}

const settle = async (card: FluvyScheduleCard): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await card.updateComplete;
  }
};

async function mount(
  config: Partial<ScheduleCardConfig>,
  fixture = house(),
): Promise<FluvyScheduleCard> {
  const card = document.createElement('fluvy-schedule-card') as FluvyScheduleCard;
  card.setConfig({
    type: 'custom:fluvy-schedule-card',
    entity: 'climate.bedroom',
    _now: NOW,
    ...config,
  });
  card.hass = fixture.hass;
  document.body.append(card);
  await settle(card);
  return card;
}

const root = (card: FluvyScheduleCard): ShadowRoot => card.shadowRoot as ShadowRoot;
/** The card's sheet, once its chunk has landed (the first one to open fetches it) and it has drawn. */
const sheetOf = async (card: FluvyScheduleCard): Promise<FluvyHeatingSheet> => {
  for (let i = 0; i < 200 && !root(card).querySelector('fluvy-heating-sheet'); i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  const sheet = root(card).querySelector('fluvy-heating-sheet') as FluvyHeatingSheet;
  await sheet.updateComplete;
  return sheet;
};
const text = (card: FluvyScheduleCard, selector: string): string[] =>
  [...root(card).querySelectorAll(selector)].map((el) =>
    (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
const sub = (card: FluvyScheduleCard): string =>
  text(card, '.fv-card__head .fv-card__sub')[0] ?? '';

describe('the Heating schedule card', () => {
  afterEach(() => document.body.replaceChildren());

  it('draws the week from the helper, in its presets’ tones, the base the gaps’; the legend with the temperatures', async () => {
    const fixture = house();
    const card = await mount({}, fixture);
    expect(text(card, '.sc-day')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(root(card).querySelectorAll('.sc-track')).toHaveLength(7);
    expect(root(card).querySelectorAll('.sc-block.fv-tone--heat')).toHaveLength(12);
    expect(text(card, '.sc-item')).toEqual(['Comfort 21°', 'Eco 18°', 'Away 16°']);
    expect(root(card).querySelector('.sc-swatch.is-base')).not.toBeNull();
    // what the thermostat is doing, the preset in force and its target, the room now
    expect(sub(card)).toBe('Heating · Comfort 21° · Now 20.6°');
    expect(text(card, '.sc-item.is-active')).toEqual(['Comfort 21°']);
    // today's line carries the marker of the time it is now
    expect(root(card).querySelectorAll('.sc-now')).toHaveLength(1);
    // an administrator reads the automation's config once, and the helper is heard, not asked
    expect(fixture.callApi.mock.calls.map((call) => call[1])).toEqual([
      `config/automation/config/${BEDROOM.id}`,
    ]);
    expect(fixture.callWS.mock.calls.some((call) => call[0].type === 'call_service')).toBe(false);
  });

  it('starts its week on the day asked, and draws today’s line alone in its own layout', async () => {
    const sunday = await mount({ first_weekday: 'sunday' });
    expect(text(sunday, '.sc-day')[0]).toBe('Sun');
    const today = await mount({ variant: 'today' });
    expect(root(today).querySelectorAll('.sc-track')).toHaveLength(1);
    expect(root(today).querySelector('.sc-track--tall')).not.toBeNull();
    expect(root(today).querySelectorAll('.sc-block')).toHaveLength(2);
  });

  it('shows a guest the week and the switch, never reading a config: the presets by name, without figures', async () => {
    const fixture = house({ admin: false });
    const card = await mount({}, fixture);
    expect(fixture.callApi).not.toHaveBeenCalled();
    expect(root(card).querySelectorAll('.sc-block')).toHaveLength(12);
    expect(text(card, '.sc-item')).toEqual(['Comfort']);
    expect(root(card).querySelector('.fv-switch')).not.toBeNull();
    expect(sub(card)).toBe('Heating · Comfort 21° · Now 20.6°');
  });

  it('reads a YAML schedule’s week from the entity itself', async () => {
    const fixture = house();
    const card = await mount({ entity: 'climate.study', schedule: 'schedule.study' }, fixture);
    expect(fixture.callWS.mock.calls.map((call) => call[0])).toContainEqual(
      expect.objectContaining({
        type: 'call_service',
        domain: 'schedule',
        service: 'get_schedule',
        target: { entity_id: 'schedule.study' },
        return_response: true,
      }),
    );
    expect(root(card).querySelectorAll('.sc-block')).toHaveLength(11);
    // no automation applies it yet: no switch
    expect(root(card).querySelector('.fv-switch')).toBeNull();
  });

  it('offers an administrator to create a schedule where the thermostat has none, and tells anyone else who can', async () => {
    const admin = await mount({ entity: 'climate.kids' });
    expect(text(admin, '.fv-empty-state__text')).toEqual(['No heating schedule yet']);
    expect(text(admin, '.sc-empty .fv-btn')).toEqual(['Create a schedule']);
    const guest = await mount({ entity: 'climate.kids' }, house({ admin: false }));
    expect(root(guest).querySelector('.sc-empty .fv-btn')).toBeNull();
    expect(text(guest, '.fv-empty-state__hint')).toEqual(['An administrator can create one']);
  });

  it('keeps its anatomy out of reach: the lines, the legend, the switch, the line saying why', async () => {
    const heating = { ...BEDROOM, climate: 'climate.attic' };
    const fixture = house();
    fixture.configs.set(BEDROOM.id, buildHeating(heating));
    const card = await mount({ entity: 'climate.attic' }, fixture);
    expect(root(card).querySelector('.fv-card.is-unavailable')).not.toBeNull();
    expect(root(card).querySelectorAll('.sc-track')).toHaveLength(7);
    expect(text(card, '.sc-item')).toHaveLength(3);
    expect(sub(card)).toBe('Unavailable');
  });

  it('declares its height from its layout and what it shows, never from the plan', () => {
    const height = (config: Record<string, unknown>): number =>
      scheduleHeight({ type: 'custom:fluvy-schedule-card', ...config });
    expect(height({})).toBe(376);
    expect(height({ variant: 'today' })).toBe(192);
    expect(height({ show_head: false })).toBe(316);
    expect(height({ show_presets: false })).toBe(340);
    expect(height({ variant: 'today', show_head: false, show_presets: false })).toBe(96);
    // the row is the house's, whatever it shows
    expect(height({ variant: 'row' })).toBe(76);
    expect(height({ variant: 'row', show_head: false, show_presets: false })).toBe(76);
    for (const config of [{}, { variant: 'today' }, { show_head: false }])
      expect(height(config) % 4).toBe(0);
  });

  describe('as a row', () => {
    const line = (card: FluvyScheduleCard): string => text(card, '.sc-row .fv-row__sub')[0] ?? '';

    it('says the preset in force, its target and the next change beside the room’s circle, the switch at its end', async () => {
      const card = await mount({ variant: 'row' });
      expect(root(card).querySelector('.sc-row')).not.toBeNull();
      expect(root(card).querySelector('.fv-card__head')).toBeNull();
      expect(root(card).querySelector('.sc-track')).toBeNull();
      expect(text(card, '.sc-row .fv-row__title')).toEqual(['Bedroom']);
      // Thursday 21:47, Comfort until 22:30 and the gaps' Eco after it
      expect(line(card)).toBe('Comfort · 21° · Eco at 22:30');
      expect(root(card).querySelector('.sc-row > .fv-ico.fv-ico--heat')).not.toBeNull();
      expect(root(card).querySelector('.sc-row > .fv-hit .fv-switch.is-on')).not.toBeNull();
      expect(card.getGridOptions()).toMatchObject({ columns: 6, min_columns: 6 });
    });

    it('says another day’s change with its weekday, and none a guest cannot know (the gaps’ preset)', async () => {
      // Thursday 23:00 in a gap, the helper off: the base's Eco, Comfort on Friday morning
      const gap = {
        ...STATES,
        'schedule.bedroom_heating': entity('schedule.bedroom_heating', 'off', { editable: true }),
      };
      const late = await mount(
        { variant: 'row', _now: '2026-09-17T21:00:00Z' },
        house({ states: gap }),
      );
      expect(line(late)).toBe('Eco · 21° · Comfort Fri at 06:30');
      const guest = await mount({ variant: 'row' }, house({ admin: false }));
      expect(line(guest)).toBe('Comfort · 21°');
    });

    it('says the schedule is off where its automation is, and keeps its anatomy out of reach', async () => {
      const off = {
        ...STATES,
        'automation.heating_bedroom': entity('automation.heating_bedroom', 'off', {
          friendly_name: BEDROOM.alias,
          id: BEDROOM.id,
        }),
      };
      const paused = await mount({ variant: 'row' }, house({ states: off }));
      expect(line(paused)).toBe('Schedule off · 21°');
      expect(root(paused).querySelector('.sc-row > .fv-ico.fv-ico--neutral')).not.toBeNull();
      const fixture = house();
      fixture.configs.set(BEDROOM.id, buildHeating({ ...BEDROOM, climate: 'climate.attic' }));
      const attic = await mount({ variant: 'row', entity: 'climate.attic' }, fixture);
      expect(root(attic).querySelector('.sc-row.is-unavailable')).not.toBeNull();
      expect(line(attic)).toBe('Unavailable');
      expect(root(attic).querySelector('.sc-row .fv-switch')).not.toBeNull();
      // no schedule yet: said so, and no switch
      const kids = await mount({ variant: 'row', entity: 'climate.kids' });
      expect(line(kids)).toBe('No heating schedule yet');
      expect(root(kids).querySelector('.fv-switch')).toBeNull();
    });

    it('opens the sheet on a tap, for reading only to anyone but an administrator', async () => {
      const card = await mount({ variant: 'row' }, house({ admin: false }));
      root(card).querySelector<HTMLElement>('.sc-row > .fv-tile__tap')?.click();
      await settle(card);
      const sheet = await sheetOf(card);
      expect(sheet.isOpen).toBe(true);
      expect(sheet.shadowRoot!.querySelector('.hs-note')?.textContent?.trim()).toBe(
        'Only an administrator can change the schedule',
      );
    });

    it('gives way narrow: the next change, the circle, then the switch with the circle back; the figure never', async () => {
      // every class's letters 8 wide: "Bedroom" needs its 56, "21°" its 24
      const ruler = vi
        .spyOn(TextRuler.prototype, 'width')
        .mockImplementation((_cls: string, text: string) => text.length * 8);
      try {
        const card = await mount({ variant: 'row' });
        const at = async (width: number): Promise<[boolean, boolean, string]> => {
          (card as unknown as { width: number }).width = width;
          await settle(card);
          return [
            root(card).querySelector('.sc-row > .fv-ico') !== null,
            root(card).querySelector('.sc-row > .fv-hit') !== null,
            line(card),
          ];
        };
        // 266: the row's 234 less the circle's 56 and the switch's 68 holds the name; the next change leaves
        expect(await at(266)).toEqual([true, true, 'Comfort · 21°']);
        // 211: 55 would cut the name: the circle gives way, the switch stays
        expect(await at(211)).toEqual([false, true, 'Comfort · 21°']);
        // 152: 52 beside the switch would cut it still: the switch gives way, the circle back, the figure alone
        expect(await at(152)).toEqual([true, false, '21°']);
        expect(await at(400)).toEqual([true, true, 'Comfort · 21° · Eco at 22:30']);
      } finally {
        ruler.mockRestore();
      }
    });
  });

  it('asks Home Assistant once where two views of one house differ in their automations (a twin out of reach)', async () => {
    const fixture = house();
    const live = await mount({}, fixture);
    // the same connection, the schedule's automation gone from this view of the house
    const states = Object.fromEntries(
      Object.entries(fixture.hass.states).filter(([id]) => id !== 'automation.heating_bedroom'),
    );
    const away = { ...fixture.hass, states } as HomeAssistant;
    const twin = await mount({}, { ...fixture, hass: away });
    const asked = (): number =>
      fixture.callWS.mock.calls.filter((call) => call[0]['type'] === 'search/related').length;
    const before = asked();
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve));
    await Promise.all([live.updateComplete, twin.updateComplete]);
    // each asked when its house came, never again by the other's answer: no ping-pong between the two lists
    expect(asked() - before).toBeLessThanOrEqual(2);
  });

  it('switches the schedule’s automation, and runs it once switched on', async () => {
    const fixture = house();
    const card = await mount({}, fixture);
    root(card).querySelector<HTMLElement>('.fv-switch')?.click();
    expect(fixture.callService).toHaveBeenCalledWith(
      'automation',
      'turn_off',
      {},
      {
        entity_id: 'automation.heating_bedroom',
      },
    );
  });

  it('writes the helper and the automation from the sheet, each in the shape it reads back, and runs it', async () => {
    const fixture = house();
    const card = await mount({}, fixture);
    root(card).querySelector<HTMLElement>('.fv-card__tap')?.click();
    await settle(card);
    const sheet = await sheetOf(card);
    expect(sheet.isOpen).toBe(true);
    // Monday's first time one hour later, Comfort a degree warmer
    const draft = sheet.draft_!;
    sheet.draft_ = {
      ...draft,
      week: withDay(draft.week, 'monday', [
        { ...draft.week.monday[0]!, from: 7 * 60 + 30 },
        draft.week.monday[1]!,
      ]),
      presets: draft.presets.map((preset) =>
        preset.key === 'comfort' ? { ...preset, temperature: 22 } : preset,
      ),
    };
    await sheet.updateComplete;
    // a press this soon after opening is the tail of the tap that opened it
    (sheet as unknown as { openedAt: number }).openedAt = 0;
    sheet.shadowRoot!.querySelector<HTMLElement>('.dv-actions .fv-btn--accent')?.click();
    await settle(card);
    const update = fixture.callWS.mock.calls
      .map((call) => call[0])
      .find((m) => m.type === 'schedule/update');
    expect(update).toMatchObject({
      schedule_id: 'bedroom_heating',
      name: 'Bedroom heating',
      icon: 'mdi:calendar-clock',
    });
    expect(update.monday[0]).toEqual({
      from: '07:30:00',
      to: '08:30:00',
      data: { preset: 'comfort' },
    });
    expect(update.saturday).toHaveLength(1);
    const post = fixture.callApi.mock.calls.find((call) => call[0] === 'POST');
    expect(post?.[1]).toBe(`config/automation/config/${BEDROOM.id}`);
    expect(parseHeating(post?.[2])?.presets[0]).toEqual({
      key: 'comfort',
      name: 'Comfort',
      temperature: 22,
    });
    expect(sheet.isOpen).toBe(false);
    // it runs once its automation stands, so the time it is now takes effect
    expect(fixture.callService).toHaveBeenCalledWith(
      'automation',
      'trigger',
      { skip_condition: false },
      { entity_id: 'automation.heating_bedroom' },
    );
  });

  it('makes a new helper named after the room and its automation, and takes the helper back where the automation is refused', async () => {
    const fixture = house({ refuse: true });
    const card = await mount({ entity: 'climate.kids' }, fixture);
    root(card).querySelector<HTMLElement>('.sc-empty .fv-btn')?.click();
    await settle(card);
    const sheet = await sheetOf(card);
    (sheet as unknown as { openedAt: number }).openedAt = 0;
    sheet.shadowRoot!.querySelector<HTMLElement>('.dv-actions .fv-btn--accent')?.click();
    await settle(card);
    const messages = fixture.callWS.mock.calls.map((call) => call[0]);
    const create = messages.find((m) => m.type === 'schedule/create');
    expect(create).toMatchObject({ name: 'Kids’ room heating', icon: 'mdi:calendar-clock' });
    expect(create.monday).toEqual(helperDays(startWeek('comfort')).monday);
    // Home Assistant refused the automation: the helper just made is deleted, the sheet says why and stays open
    expect(messages.find((m) => m.type === 'schedule/delete')).toMatchObject({
      schedule_id: 'kids_room_heating',
    });
    expect(sheet.isOpen).toBe(true);
    expect(sheet.shadowRoot!.querySelector('.hs-error')?.textContent?.trim()).toBe(
      'Message malformed',
    );
  });

  it('opens the sheet for reading only to anyone but an administrator, writing nothing', async () => {
    const fixture = house({ admin: false });
    const card = await mount({}, fixture);
    root(card).querySelector<HTMLElement>('.fv-card__tap')?.click();
    await settle(card);
    const sheet = await sheetOf(card);
    expect(sheet.shadowRoot!.querySelector('.hs-note')?.textContent?.trim()).toBe(
      'Only an administrator can change the schedule',
    );
    expect(sheet.shadowRoot!.querySelector('fluvy-time-field')).toBeNull();
    expect(sheet.shadowRoot!.querySelector('.fv-btn--accent')).toBeNull();
    // the plan as it stands, nothing added; a temperature a guest cannot read is unknown, never made up
    const presets = [...sheet.shadowRoot!.querySelectorAll('.hs-preset')].map((row) =>
      (row.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(presets).toEqual(['Comfort—']);
  });
});

describe('the Heating schedule card’s editor', () => {
  afterEach(() => document.body.replaceChildren());

  const shown = async (config: Record<string, unknown>): Promise<string[]> => {
    const editor = await FluvyScheduleCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = house().hass;
    const drawn = await drawEditor(editor, {
      type: 'custom:fluvy-schedule-card',
      entity: 'climate.bedroom',
      ...config,
    });
    return shownNames(cardForm(drawn).schema);
  };

  it('shows the head’s options only while the card has its head', async () => {
    expect(await shown({})).toEqual(
      expect.arrayContaining(['schedule', 'variant', 'first_weekday', 'show_switch', 'show_icon']),
    );
    const headless = await shown({ show_head: false });
    expect(headless).not.toContain('show_switch');
    expect(headless).not.toContain('show_icon');
    expect(headless).toContain('show_presets');
  });

  it('offers a row its switch and what it draws, never a head’s options or a legend', async () => {
    const row = await shown({ variant: 'row', show_head: false });
    expect(row).toEqual(
      expect.arrayContaining(['variant', 'first_weekday', 'show_switch', 'icon', 'tone']),
    );
    for (const name of ['show_head', 'show_presets', 'show_icon', 'name_lines'])
      expect(row).not.toContain(name);
  });
});
