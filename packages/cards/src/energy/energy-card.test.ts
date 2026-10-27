// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import fixtures from '../chart/engine/__fixtures__/classic-1.10.json' with { type: 'json' };
import { familiesDefined } from '../index.js';
import { FluvyEnergyCard, type EnergyCardConfig } from './energy-card.js';

// the family is defined as its chunk lands
await familiesDefined;

const { TEMP } = fixtures.inputs;
/** A house's power over the window (W): the fixtures' day, a thousand times over, ending on its reading. */
const POWER = TEMP.map((v) => Math.round(v * 100));

/** A house whose recorder answers every window with the power, one reading in the middle of each of its 48 slots. */
const house = (values: readonly number[] = POWER): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { time_zone: 'UTC' },
    themes: { darkMode: false },
    states: {
      'sensor.power': {
        entity_id: 'sensor.power',
        state: String(values[values.length - 1]),
        attributes: {
          friendly_name: 'House power',
          unit_of_measurement: 'W',
          device_class: 'power',
          state_class: 'measurement',
        },
        last_changed: '',
        last_updated: '',
      },
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async (message: Record<string, unknown>) => {
      const start = Date.parse(String(message['start_time']));
      const end = Date.parse(String(message['end_time']));
      return {
        'sensor.power': values.map((v, i) => ({
          s: String(v),
          lu: (start + ((i + 0.5) / values.length) * (end - start)) / 1000,
        })),
      };
    },
    callService: async () => undefined,
  }) as unknown as HomeAssistant;

const settle = async (card: FluvyEnergyCard): Promise<void> => {
  for (let i = 0; i < 3; i++) {
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

/** A card over a rolling window (six hours: the series spans the card), so its chart is the fixtures' frame. */
async function mount(config: Partial<EnergyCardConfig>): Promise<FluvyEnergyCard> {
  const card = document.createElement('fluvy-energy-card') as FluvyEnergyCard;
  card.setConfig({ type: 'custom:fluvy-energy-card', entity: 'sensor.power', hours: 6, ...config });
  card.hass = house();
  document.body.append(card);
  await settle(card);
  return card;
}

const ds = (card: FluvyEnergyCard, selector: string): string[] =>
  [...card.shadowRoot!.querySelectorAll(selector)].map((el) => el.getAttribute('d') ?? '');

afterEach(() => document.body.replaceChildren());

describe('the energy card’s line, drawn by the engine', () => {
  it('draws classic as 1.10 did, path for path, while the house keeps its factory style', async () => {
    // the fixtures' sensor curve: its shape is the power's, a hundred times over (a tight scale reads no unit)
    const card = await mount({});
    const line = ds(card, '.ef-chart .curve-line');
    expect(line).toEqual([fixtures.curveGeometry.sensor.line]);
    expect(ds(card, '.ef-chart .curve-area')).toEqual([fixtures.curveGeometry.sensor.area]);
    expect(card.shadowRoot!.querySelectorAll('.ef-chart .curve-dot').length).toBe(1);
  });

  it('keeps a classic thin line at 1.10’s one pixel, the card’s own rule', async () => {
    const card = await mount({ line_width: 'thin' });
    const line = card.shadowRoot!.querySelector('.ef-chart .curve-line') as SVGElement;
    expect(line.getAttribute('style')).toBeNull();
    expect(card.shadowRoot!.querySelector('.ef-chart.is-thin')).not.toBeNull();
  });

  it('draws the style the card names: the soft line, its copy and Fluvy’s knob at its end', async () => {
    const card = await mount({ chart: 'soft' });
    const root = card.shadowRoot!;
    expect(root.querySelectorAll('.ef-chart .fc-line').length).toBe(1);
    expect(root.querySelectorAll('.ef-chart .fc-glow').length).toBe(1);
    expect(root.querySelectorAll('.ef-chart .fv-knob').length).toBe(1);
    expect(root.querySelector('.ef-chart .curve-line')).toBeNull();
  });

  it('draws a stepped power on a scale from zero in the card’s unit, the hours under the plot', async () => {
    const card = await mount({ chart: 'step' });
    const root = card.shadowRoot!;
    const ticks = [...root.querySelectorAll('.fc-tick')].map((t) => t.textContent);
    // 1.6 … 2.4 kW read in kW, from zero: power starts there
    expect(ticks[0]).toBe('0');
    expect(ticks.every((t) => Number(t) <= 3)).toBe(true);
    const axis = root.querySelector('.ef-chart + div') as HTMLElement;
    expect(parseFloat(axis.style.marginInlineStart)).toBeGreaterThan(0);
  });

  it('draws minimal without a bubble at rest: the style labels nothing', async () => {
    const card = await mount({ chart: 'minimal' });
    expect(card.shadowRoot!.querySelector('.ef-chart .fv-bubble')).toBeNull();
    expect(card.shadowRoot!.querySelectorAll('.ef-chart .fc-line').length).toBe(1);
  });
});

describe('the energy card’s editor', () => {
  const section = (FluvyEnergyCard.getConfigForm().schema as HaFormSchemaItem[]).find(
    (item) => item.type === 'expandable' && item.schema?.some((field) => field.name === 'chart'),
  ) as HaFormSchemaItem;
  const fields = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
    schema.flatMap((item) => (item.schema ? fields(item.schema) : [item]));
  const shown = (data: Record<string, unknown>): string[] =>
    (section.schema ?? [])
      .filter((item) => !item.when || item.when(data))
      .flatMap((item) => fields([item]).filter((field) => !field.when || field.when(data)))
      .map(
        (field) =>
          `${field.name}${field.name === 'chart' ? `:${JSON.stringify((field.selector as { select: { options: { value: string }[] } }).select.options.map((o) => o.value))}` : ''}`,
      );

  it('offers the line the line styles, and a stacked chart classic, soft and step', () => {
    expect(shown({})[0]).toBe('chart:["classic","soft","glow","minimal","step"]');
    expect(shown({ variant: 'compact' })[0]).toBe(
      'chart:["classic","soft","glow","minimal","step"]',
    );
    expect(shown({ variant: 'sources' })[0]).toBe('chart:["classic","soft","step"]');
    expect(shown({ variant: 'overview' })[0]).toBe('chart:["classic","soft","step"]');
  });

  it('shows a stacked chart only its line, its gridlines and its scale; the line what its style acts on', () => {
    expect(shown({ variant: 'sources', chart: 'soft' }).slice(1)).toEqual([
      'line_width',
      'show_grid',
      'show_axis',
    ]);
    expect(shown({ chart: 'soft' })).toContain('glow');
    expect(shown({})).not.toContain('glow');
    expect(shown({})).not.toContain('show_now');
  });
});
