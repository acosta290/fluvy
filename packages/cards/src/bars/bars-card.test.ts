// @vitest-environment happy-dom
import {
  CHART_DEFAULTS,
  setChartDefaults,
  type HaFormSchemaItem,
  type HassConnection,
  type HomeAssistant,
} from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { visibleFields } from '../shared/form.js';
import { FluvyBarsCard, type BarsCardConfig } from './bars-card.js';

if (!customElements.get('fluvy-bars-card')) customElements.define('fluvy-bars-card', FluvyBarsCard);

const reading = (id: string, state: string, attributes: Record<string, unknown>) => ({
  [id]: { entity_id: id, state, attributes, last_changed: '', last_updated: '' },
});
const percent = (name: string, deviceClass?: string) => ({
  friendly_name: name,
  unit_of_measurement: '%',
  ...(deviceClass ? { device_class: deviceClass } : {}),
});

const house = (): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {
      ...reading('sensor.east', '1400', {
        unit_of_measurement: 'W',
        device_class: 'power',
        friendly_name: 'East',
      }),
      // shares at 6 %: a processor's use, a battery, a plant's soil, a room's air
      ...reading('sensor.cpu', '6', percent('CPU usage')),
      ...reading('sensor.remote_battery', '6', percent('Remote', 'battery')),
      ...reading('sensor.fern_moisture', '6', percent('Fern', 'moisture')),
      ...reading('sensor.attic_humidity', '6', percent('Attic', 'humidity')),
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async () => ({}),
  }) as unknown as HomeAssistant;

async function mount(config: Partial<BarsCardConfig>): Promise<FluvyBarsCard> {
  const card = document.createElement('fluvy-bars-card') as FluvyBarsCard;
  card.setConfig({ type: 'custom:fluvy-bars-card', rows: ['sensor.east'], ...config });
  card.hass = house();
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const soft = (card: FluvyBarsCard): boolean =>
  card.shadowRoot!.querySelector('.so-rows')?.classList.contains('is-soft') ?? false;

afterEach(() => {
  document.body.replaceChildren();
  setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
});

describe('the bars, in their chart styles', () => {
  it('draws classic as 1.10 did, and soft where the card or the house says so', async () => {
    const classic = await mount({});
    expect(soft(classic)).toBe(false);
    expect(classic.shadowRoot!.querySelector('.fv-bar__fill')).not.toBeNull();
    expect(soft(await mount({ chart: 'soft' }))).toBe(true);
    setChartDefaults({ settings: { ...CHART_DEFAULTS, style: 'soft' }, sets: [] });
    expect(soft(await mount({}))).toBe(true);
    expect(soft(await mount({ chart: 'classic' }))).toBe(false);
  });
});

describe('a low share (#94)', () => {
  const warned = (card: FluvyBarsCard): string[] =>
    [...card.shadowRoot!.querySelectorAll('.fv-row')]
      .filter((row) => row.querySelector('.fv-row__value--warning'))
      .map((row) => row.querySelector('.fv-row__title')!.textContent!.trim());
  const badge = (card: FluvyBarsCard): string =>
    card.shadowRoot!.querySelector('.fv-badge')?.textContent?.trim() ?? '';

  it('warns under 20 % for what runs low, a battery and a plant’s soil; any other share only under its own `low`', async () => {
    const card = await mount({
      rows: [
        'sensor.cpu',
        'sensor.remote_battery',
        'sensor.fern_moisture',
        'sensor.attic_humidity',
      ],
    });
    expect(warned(card)).toEqual(['Remote', 'Fern']);
    expect(badge(card)).toBe('2 low');
    const own = await mount({ rows: [{ entity: 'sensor.cpu', low: 10 }] });
    expect(warned(own)).toEqual(['CPU usage']);
  });

  it('a share’s bar still runs from 0 to 100', async () => {
    const card = await mount({ rows: ['sensor.cpu', 'sensor.attic_humidity'] });
    const fills = [...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-bar__fill')];
    expect(fills.map((fill) => fill.getAttribute('style'))).toEqual(
      fills.map(() => expect.stringContaining('6%')),
    );
  });
});

describe('a list in parts, and rows on a condition (#157)', () => {
  /** What the list draws, in its order: a label as its words, a hairline alone as `-`, a row as its name. */
  const drawn = (card: FluvyBarsCard): string[] =>
    [...card.shadowRoot!.querySelectorAll('.so-rows > *')].map((node) =>
      node.classList.contains('fv-divider')
        ? '-'
        : (node
            .querySelector('.fv-label, .fv-row__title, .fv-empty-state__text')
            ?.textContent?.trim() ?? ''),
    );
  const badge = (card: FluvyBarsCard): string =>
    card.shadowRoot!.querySelector('.fv-badge')?.textContent?.trim() ?? '';
  const height = (config: Partial<BarsCardConfig>): number =>
    FluvyBarsCard.layoutHeight({ type: 'custom:fluvy-bars-card', ...config });
  const watchedBy = (card: FluvyBarsCard): readonly string[] =>
    (card as unknown as { watched(): readonly string[] }).watched();
  const BATTERIES = ['sensor.remote_battery', 'sensor.fern_moisture'];
  /** The house with the remote's battery at `level`, and whether guests are staying. */
  const withLevel = (level: string, guests = 'off'): HomeAssistant => {
    const hass = house();
    return {
      ...hass,
      states: {
        ...hass.states,
        ...reading('sensor.remote_battery', level, percent('Remote', 'battery')),
        ...reading('input_boolean.guests', guests, { friendly_name: 'Guests' }),
      },
    } as HomeAssistant;
  };

  it('draws a section’s label, a hairline over it where asked, and a divider, among its rows', async () => {
    const card = await mount({
      rows: [
        { type: 'section', label: 'Devices' },
        'sensor.remote_battery',
        { type: 'divider' },
        'sensor.cpu',
        { section: 'Plants', line: true },
        'sensor.fern_moisture',
      ],
    });
    expect(drawn(card)).toEqual(['Devices', 'Remote', '-', 'CPU usage', 'Plants', 'Fern']);
    const [devices, plants] = [...card.shadowRoot!.querySelectorAll('.fv-section')];
    expect(devices!.classList.contains('fv-section--line')).toBe(false);
    expect(plants!.classList.contains('fv-section--line')).toBe(true);
    // the sections are no rows: nothing to tap, nothing counted
    expect(card.shadowRoot!.querySelectorAll('.fv-row').length).toBe(3);
    expect(badge(card)).toBe('2 low');
  });

  it('writes a section’s words as text, never as markup', async () => {
    const words = '<img src=x onerror="window.pwned = 1"><b>Up</b>';
    const card = await mount({ rows: [{ section: words }, 'sensor.cpu'] });
    const label = card.shadowRoot!.querySelector('.fv-section .fv-label')!;
    expect(label.textContent).toBe(words);
    expect(label.children.length).toBe(0);
    expect(card.shadowRoot!.querySelector('img, b')).toBeNull();
  });

  it('declares every row and the sections between them: a label 28, the first 20, a hairline alone 16', () => {
    const rows = ['sensor.cpu', 'sensor.east'];
    const plain = height({ rows });
    expect(height({ rows: [{ section: 'A' }, ...rows] })).toBe(plain + 20);
    expect(height({ rows: ['sensor.cpu', { section: 'B' }, 'sensor.east'] })).toBe(plain + 28);
    expect(height({ rows: ['sensor.cpu', { type: 'divider' }, 'sensor.east'] })).toBe(plain + 16);
    expect(height({ variant: 'compact', rows: [{ section: 'A' }, ...rows] })).toBe(
      height({ variant: 'compact', rows }) + 20,
    );
    // whatever a condition says now, the config's rows are all counted
    expect(height({ rows, show_rows_when: { below: 0 } })).toBe(plain);
    expect(
      height({ rows: [{ entity: 'sensor.cpu', show_when: { below: 0 } }, 'sensor.east'] }),
    ).toBe(plain);
    // sections alone are an empty list
    expect(height({ rows: [{ section: 'A' }, { type: 'divider' }] })).toBe(height({ rows: [] }));
  });

  it('shows a row only while its condition holds, its section with it, and counts the rows that show', async () => {
    const card = await mount({
      rows: [
        { section: 'Devices' },
        { entity: 'sensor.remote_battery', show_when: { below: 30 } },
        { entity: 'sensor.cpu', show_when: { above: 50 } },
        { section: 'Plants' },
        { entity: 'sensor.fern_moisture', show_when: { above: 50 } },
      ],
    });
    // the remote at 6 %: its row under its label; the fern at 6 % is away, and its label with it
    expect(drawn(card)).toEqual(['Devices', 'Remote']);
    expect(badge(card)).toBe('1 low');
    // charged, it leaves, and with no row showing the card is its empty panel, the badge gone
    card.hass = withLevel('84');
    await card.updateComplete;
    expect(drawn(card)).toEqual(['No readings']);
    expect(card.shadowRoot!.querySelector('.fv-empty-state')).not.toBeNull();
    expect(badge(card)).toBe('');
    card.hass = withLevel('12');
    await card.updateComplete;
    expect(drawn(card)).toEqual(['Devices', 'Remote']);
  });

  it('gives every row the card’s condition, a row’s own winning over it', async () => {
    const card = await mount({
      show_rows_when: { below: 30 },
      rows: [...BATTERIES, 'sensor.east', { entity: 'sensor.cpu', show_when: { above: 50 } }],
    });
    expect(drawn(card)).toEqual(['Remote', 'Fern']);
    expect(badge(card)).toBe('2 low');
    card.hass = withLevel('84');
    await card.updateComplete;
    expect(drawn(card)).toEqual(['Fern']);
    expect(badge(card)).toBe('1 low');
  });

  it('says its own words with no row showing, and steps aside where asked', async () => {
    const card = await mount({
      rows: BATTERIES,
      show_rows_when: { below: 5 },
      empty_text: 'Nothing under 5 %',
    });
    expect(drawn(card)).toEqual(['Nothing under 5 %']);
    expect(card.hidden).toBe(false);
    const hidden = await mount({ rows: BATTERIES, show_rows_when: { below: 5 }, hide_empty: true });
    expect(hidden.hidden).toBe(true);
    // back the moment a row shows
    hidden.hass = withLevel('2');
    await hidden.updateComplete;
    expect(hidden.hidden).toBe(false);
    expect(drawn(hidden)).toEqual(['Remote']);
  });

  it('reads another entity where the condition names one, and draws again when it changes', async () => {
    const card = await mount({
      rows: [
        'sensor.cpu',
        { entity: 'sensor.east', show_when: { entity: 'input_boolean.guests', state: 'on' } },
      ],
    });
    expect(watchedBy(card)).toContain('input_boolean.guests');
    card.hass = withLevel('6', 'off');
    await card.updateComplete;
    expect(drawn(card)).toEqual(['CPU usage']);
    card.hass = withLevel('6', 'on');
    await card.updateComplete;
    expect(drawn(card)).toEqual(['CPU usage', 'East']);
    // the card's own condition's entity is watched too
    const every = await mount({
      rows: ['sensor.cpu'],
      show_rows_when: { entity: 'input_boolean.guests', state: 'on' },
    });
    expect(watchedBy(every)).toContain('input_boolean.guests');
  });

  it('measures a bar nobody bounded against the largest bar that shows', async () => {
    const hass = house();
    const card = document.createElement('fluvy-bars-card') as FluvyBarsCard;
    card.setConfig({
      type: 'custom:fluvy-bars-card',
      rows: ['sensor.east', { entity: 'sensor.west', show_when: { below: 2000 } }],
    });
    card.hass = {
      ...hass,
      states: {
        ...hass.states,
        ...reading('sensor.west', '2800', {
          unit_of_measurement: 'W',
          device_class: 'power',
          friendly_name: 'West',
        }),
      },
    } as HomeAssistant;
    document.body.append(card);
    await card.updateComplete;
    // the west string is away: the east one is the largest drawn, a full bar
    expect(drawn(card)).toEqual(['East']);
    expect(
      card.shadowRoot!.querySelector<HTMLElement>('.fv-bar__fill')!.getAttribute('style'),
    ).toContain('100%');
  });
});

describe('a band’s ends and the badge from the house (#253)', () => {
  /**
   * A socket that answers each template it has words for a moment after it is asked, and again when `say` changes
   * them; one it has none for is refused, as Home Assistant refuses a broken one. `live`: its open subscriptions;
   * `asked`: every subscription it was ever asked for.
   */
  const socket = (answers: Record<string, string>) => {
    const open = new Map<string, (event: unknown) => void>();
    let asked = 0;
    const connection = {
      subscribeMessage: (callback: (event: unknown) => void, message: Record<string, unknown>) => {
        const template = String(message['template']);
        if (answers[template] === undefined) return Promise.reject(new Error('TemplateError'));
        const entity = (message['variables'] as { entity?: string } | undefined)?.entity;
        const key = `${entity ?? ''} ${template}`;
        asked += 1;
        open.set(key, callback);
        setTimeout(() => callback({ result: answers[template] }), 5);
        return Promise.resolve(() => open.delete(key));
      },
    } as unknown as HassConnection;
    return {
      connection,
      live: () => open.size,
      asked: () => asked,
      say: (template: string, result: string) => {
        answers[template] = result;
        for (const [key, callback] of open) if (key.endsWith(` ${template}`)) callback({ result });
      },
    };
  };

  const HIGH = "{{ states('input_number.humidity_high') }}";
  const BATHROOM_HIGH = "{{ states('input_number.humidity_high') | int + 10 }}";
  const DRYING = "{{ 'Drying' if is_state('switch.dehumidifier', 'on') else '' }}";
  const FINE = "{{ 'Fresh air' }}";

  /** The house's rooms at their humidity, their low limit in a helper (40 %), an inverter's limit and more. */
  const rooms = (low = '40', more: Record<string, unknown> = {}): HomeAssistant => {
    const hass = house();
    return {
      ...hass,
      states: {
        ...hass.states,
        ...reading('sensor.living_humidity', '47', percent('Living room', 'humidity')),
        ...reading('sensor.bedroom_humidity', '63', percent('Bedroom', 'humidity')),
        ...reading('sensor.bathroom_humidity', '74', percent('Bathroom', 'humidity')),
        ...reading('sensor.study_humidity', '36', percent('Study', 'humidity')),
        ...reading('input_number.humidity_low', low, { unit_of_measurement: '%' }),
        ...reading('input_text.air', 'Fresh', { friendly_name: 'Air' }),
        ...reading('sensor.inverter_limit', '1.8', { unit_of_measurement: 'kW' }),
        ...more,
      },
    } as HomeAssistant;
  };

  /** A bars card in `hass` on a socket that answers `answers`; `rehouse` hands it the house again, a state changed. */
  async function draw(
    config: Partial<BarsCardConfig>,
    answers: Record<string, string> = {},
    hass = rooms(),
  ) {
    const wire = socket({ ...answers });
    const card = document.createElement('fluvy-bars-card') as FluvyBarsCard;
    card.setConfig({ type: 'custom:fluvy-bars-card', ...config });
    card.hass = { ...hass, connection: wire.connection };
    document.body.append(card);
    await card.updateComplete;
    const rehouse = async (next: HomeAssistant): Promise<void> => {
      card.hass = { ...next, connection: wire.connection };
      await card.updateComplete;
    };
    return { card, ...wire, rehouse };
  }
  /** Lets the answers land and the card draw them. */
  const settle = async (card: FluvyBarsCard): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await card.updateComplete;
  };
  const warned = (card: FluvyBarsCard): string[] =>
    [...card.shadowRoot!.querySelectorAll('.fv-row')]
      .filter((row) => row.querySelector('.fv-row__value--warning'))
      .map((row) => row.querySelector('.fv-row__title')!.textContent!.trim());
  const badge = (card: FluvyBarsCard): string | null =>
    card.shadowRoot!.querySelector('.fv-badge')?.textContent?.trim() ?? null;
  const fills = (card: FluvyBarsCard): string[] =>
    [...card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-bar__fill')].map(
      (fill) => fill.getAttribute('style') ?? '',
    );

  const HUMIDITY: BarsCardConfig['rows'] = [
    { entity: 'sensor.living_humidity', low: 'input_number.humidity_low', high: HIGH },
    { entity: 'sensor.bedroom_humidity', low: 'input_number.humidity_low', high: HIGH },
    {
      entity: 'sensor.bathroom_humidity',
      low: 'input_number.humidity_low',
      high: BATHROOM_HIGH,
    },
    { entity: 'sensor.study_humidity', low: 'input_number.humidity_low', high: HIGH },
  ];

  it('reads a row’s limits from an entity and a template, live: one still to come warns of nothing', async () => {
    const { card, say, rehouse } = await draw(
      { rows: HUMIDITY },
      { [HIGH]: '60', [BATHROOM_HIGH]: '70' },
    );
    // the helper's 40 % is read at once; the highs wait for Home Assistant, and the badge's count with them
    expect(warned(card)).toEqual(['Study']);
    expect(badge(card)).toBeNull();
    await settle(card);
    expect(warned(card)).toEqual(['Bedroom', 'Bathroom', 'Study']);
    expect(badge(card)).toBe('3 low');
    // the helper moves: the living room is low at 50 %, the study is fine at 30 %
    await rehouse(rooms('50'));
    expect(warned(card)).toEqual(['Living room', 'Bedroom', 'Bathroom', 'Study']);
    await rehouse(rooms('30'));
    expect(warned(card)).toEqual(['Bedroom', 'Bathroom']);
    // the templates' answers move: a damp summer's 65 % is fine for the bedroom, 75 % for the bathroom
    say(HIGH, '65');
    say(BATHROOM_HIGH, '75');
    await card.updateComplete;
    expect(warned(card)).toEqual([]);
    expect(badge(card)).toBe('All good');
  });

  it('takes a limit that says nothing as its default: a battery still warns under 20 %', async () => {
    const NOWHERE = "{{ states('sensor.nowhere') }}";
    const { card } = await draw(
      {
        rows: [
          { entity: 'sensor.remote_battery', low: '{{ nonsense( }}' },
          { entity: 'sensor.fern_moisture', low: NOWHERE },
          { entity: 'sensor.cpu', low: 'input_number.away' },
          { entity: 'sensor.attic_humidity', low: '' },
        ],
      },
      { [NOWHERE]: 'unknown' },
    );
    await settle(card);
    // a template refused and one that says no figure: the battery's and the soil's 20; none for the others
    expect(warned(card)).toEqual(['Remote', 'Fern']);
    expect(badge(card)).toBe('2 low');
  });

  it('draws a bar against a range from the house, its entity’s unit converted; empty while a bound is to come', async () => {
    const MAX = '{{ 3600 }}';
    const { card } = await draw(
      {
        rows: [
          { entity: 'sensor.east', max: 'sensor.inverter_limit' },
          { entity: 'sensor.east', max: MAX },
        ],
      },
      { [MAX]: '3600' },
    );
    // the inverter's 1.8 kW is 1 800 of the row's watts: 1 400 W fills 78 %; the template's bound not there yet: empty
    expect(fills(card)).toEqual(['width:78%', 'width:0%']);
    await settle(card);
    expect(fills(card)).toEqual(['width:78%', 'width:39%']);
  });

  it('says the person’s badge, an entity’s state or a template’s answer, {count} filled; none while it waits', async () => {
    const STUDY: BarsCardConfig['rows'] = [
      { entity: 'sensor.study_humidity', low: 'input_number.humidity_low' },
    ];
    const drying = await draw({ rows: STUDY, badge: DRYING }, { [DRYING]: 'Drying' });
    expect(badge(drying.card)).toBeNull();
    await settle(drying.card);
    expect(badge(drying.card)).toBe('Drying');
    expect(drying.card.shadowRoot!.querySelector('.fv-badge--warning')).not.toBeNull();
    // the dehumidifier off: the badge says nothing, and the card's own words stand in
    drying.say(DRYING, '');
    await drying.card.updateComplete;
    expect(badge(drying.card)).toBe('1 low');

    const COUNT = "{{ '{count} to air' }}";
    const counted = await draw({ rows: STUDY, badge_warn: COUNT }, { [COUNT]: '{count} to air' });
    await settle(counted.card);
    expect(badge(counted.card)).toBe('1 to air');
    const fresh = await draw({ rows: ['sensor.living_humidity'], badge_ok: 'input_text.air' });
    expect(badge(fresh.card)).toBe('Fresh');
    // words written as nothing: no badge, never an empty pill
    const none = await draw({ rows: ['sensor.living_humidity'], badge_ok: '' });
    expect(badge(none.card)).toBeNull();
  });

  it('keeps a hidden row’s templates and both badges’ live, and lets them go when the card leaves', async () => {
    const guests = (on: boolean): HomeAssistant =>
      rooms('40', reading('input_boolean.guests', on ? 'on' : 'off', {}));
    const { card, rehouse, asked } = await draw(
      {
        rows: [
          'sensor.living_humidity',
          {
            entity: 'sensor.bedroom_humidity',
            high: HIGH,
            show_when: { entity: 'input_boolean.guests', state: 'on' },
          },
        ],
        badge_ok: FINE,
        badge_warn: DRYING,
      },
      { [HIGH]: '60', [FINE]: 'Fresh air', [DRYING]: 'Drying' },
      guests(false),
    );
    await settle(card);
    expect(badge(card)).toBe('Fresh air');
    // the hidden bedroom's high and the badge that does not show are kept: three, each asked once
    expect(asked()).toBe(3);
    await rehouse(guests(true));
    // the guests are here: the bedroom shows, its limit already known, and warns at once
    expect(warned(card)).toEqual(['Bedroom']);
    expect(badge(card)).toBe('Drying');
    expect(asked()).toBe(3);
  });

  it('lets every template go when the card leaves the page', async () => {
    const { card, live } = await draw(
      { rows: HUMIDITY, badge: DRYING },
      { [HIGH]: '60', [BATHROOM_HIGH]: '70', [DRYING]: 'Drying' },
    );
    await settle(card);
    // each row asks its high with its own entity, and the badge its words: five
    expect(live()).toBe(5);
    card.remove();
    expect(live()).toBe(0);
  });
});

describe('the editor (#253)', () => {
  it('takes a row’s range and limits as typed figures, entities or templates, and the badges as the person’s words', async () => {
    const editor = await FluvyBarsCard.editor();
    const fields = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
      schema.flatMap((item) => (item.schema ? fields(item.schema) : [item]));
    const rows = editor.lists?.find(({ key }) => key === 'rows');
    const limits = fields(rows!.schema).filter(({ name }) =>
      ['min', 'max', 'low', 'high'].includes(name),
    );
    expect(limits.map(({ name, selector, helper }) => [name, selector, helper])).toEqual(
      ['min', 'max', 'low', 'high'].map((name) => [name, { text: {} }, 'editor.threshold_helper']),
    );
    const form = editor.getConfigForm();
    const badges = (data: Record<string, unknown>) =>
      fields(visibleFields(form.schema, data))
        .filter(({ name }) => name.startsWith('badge'))
        .map(({ name, helper }) => [name, helper]);
    expect(badges({})).toEqual([
      ['badge', 'editor.own_text_helper'],
      ['badge_ok', 'editor.own_text_helper'],
      ['badge_warn', 'editor.own_text_helper'],
    ]);
    // a badge asked away has no words to say
    expect(badges({ show_badge: false })).toEqual([]);
    expect(form.computeLabel?.({ name: 'badge' } as HaFormSchemaItem, (key) => key)).toBe(
      'Badge text',
    );
  });
});
