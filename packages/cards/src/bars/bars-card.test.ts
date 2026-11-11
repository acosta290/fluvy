// @vitest-environment happy-dom
import { CHART_DEFAULTS, setChartDefaults, type HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
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
