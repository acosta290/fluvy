import { formatNumber, type EntityView, type MessageKey } from '@fluvy/core';
import {
  clamp,
  label,
  LOW_BATTERY,
  type DialChangeDetail,
  type IconRef,
  type Tone,
} from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { Burst, Hold } from '../cover/common.js';
import { endsHold } from '../shared/across.js';
import { axisHolds, type Labels } from '../shared/axis.js';
import { chipRow } from '../shared/chips.js';
import { modeWord } from '../shared/mode-words.js';
import {
  batteryLevel,
  humidityOf,
  valveOf,
  windowBy,
  type ReadingsAsk,
} from '../thermostat/readings.js';
import {
  chooseMode,
  modeChoice,
  modesDrawn,
  stepTarget,
  targetCall,
  thermostatModel,
  type ThermostatModel,
} from '../thermostat/thermostat-card.js';
import type { DaySpec } from './history.js';
import { keys, listAttr, sheetRows, type SheetRow } from './parts.js';
import { configOf, DetailsSheet, type DetailsConfig, type LiveHass, type Status } from './sheet.js';

/** A row of options a climate may have beside its modes: where it lists them, where it says the one chosen, its service. */
interface Row {
  readonly title: MessageKey;
  readonly icon: IconRef;
  readonly list: string;
  readonly attribute: string;
  readonly service: string;
}

const ROWS: readonly Row[] = [
  {
    title: 'climate.preset',
    icon: 'sliders',
    list: 'preset_modes',
    attribute: 'preset_mode',
    service: 'set_preset_mode',
  },
  {
    title: 'climate.fan',
    icon: 'fan',
    list: 'fan_modes',
    attribute: 'fan_mode',
    service: 'set_fan_mode',
  },
  {
    title: 'sheets.swing',
    icon: 'swing',
    list: 'swing_modes',
    attribute: 'swing_mode',
    service: 'set_swing_mode',
  },
  {
    title: 'sheets.swing_horizontal',
    icon: 'swap',
    list: 'swing_horizontal_modes',
    attribute: 'swing_horizontal_mode',
    service: 'set_swing_horizontal_mode',
  },
];

const sameTarget = (a: DialChangeDetail | null, b: DialChangeDetail | null): boolean =>
  a?.value === b?.value && a?.low === b?.low && a?.high === b?.high;

/**
 * What the card that opened a sheet asks to be said of its thermostat (1.21, #185): a Thermostat card's own keys; a
 * tile's `show_action` (its own, else its group's or its room's), which reads the window as the tile does. Nothing
 * where the card asks nothing.
 */
function askOf(card: unknown, entityId: string | undefined): ReadingsAsk {
  const config = configOf(card);
  if (!config) return {};
  if (String(config['type']).endsWith('fluvy-thermostat-card')) return config;
  const tiles: readonly unknown[] = Array.isArray(config['tiles']) ? config['tiles'] : [];
  const tile = tiles.find(
    (item): item is Readonly<Record<string, unknown>> =>
      typeof item === 'object' && item !== null && 'entity' in item && item.entity === entityId,
  );
  return (tile?.['show_action'] ?? config['show_action']) === true ? { show_window: true } : {};
}

/**
 * A thermostat's details — a climate's, a water heater's, a humidifier's, read as the thermostat card reads them: the
 * target on the dial (a low and a high for a range), what it measures as a dot outside the ring and under the figure;
 * one step down and one up under it; its modes as chips, each with its glyph; then its preset, its fan speed and its
 * swing, each a row that opens its options. Without its dial (`show_dial: false`, #258) the target is a ruler across
 * the sheet, what it measures said over the ruler where it reads ("Now 20.8°"); a range is two, its low end over its
 * high one, each figure a button that gives the keys to its end.
 */
export class FluvyDetailsClimate extends DetailsSheet {
  /** The target the keys stepped to, shown until the device reports it; their taps are one call once they stop. */
  private readonly stepped = new Hold<DialChangeDetail | null>(this);
  private readonly burst = new Burst();
  /** The option chosen in each row, shown until the device reports it. */
  private readonly chosen = new Map<string, Hold<string | null>>();
  /** The end of a range the keys step: the one last moved on the dial, or on its ruler; until then the low one, the high one while cooling. */
  private rangeEnd: 0 | 1 | null = null;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.burst.flush();
    this.stepped.clear();
    for (const hold of this.chosen.values()) hold.clear();
  }

  /** What its own config asks to be said of the thermostat (docked, the playground's). */
  private own: ReadingsAsk = {};
  /** What the card that opened the sheet asks (`askOf`); opened by none, or docked, what its own config asks. */
  private ask: ReadingsAsk = {};

  override setConfig(config: DetailsConfig & ReadingsAsk): void {
    super.setConfig(config);
    this.own = this.ask = config;
  }

  override open(openedBy?: HTMLElement, source?: LiveHass, zoom?: number): void {
    this.ask = source ? askOf(source, this.config?.entity) : this.own;
    super.open(openedBy, source, zoom);
  }

  /**
   * The thermostat read once for each view of it and what is asked of it: a render asks for it from every part of the
   * sheet.
   */
  private read:
    | { readonly view: EntityView; readonly ask: ReadingsAsk; readonly model: ThermostatModel }
    | undefined;

  private model(view: EntityView): ThermostatModel {
    if (this.read?.view !== view || this.read.ask !== this.ask)
      this.read = {
        view,
        ask: this.ask,
        model: thermostatModel(
          {
            hass: this.hass,
            rawHass: this.rawHass,
            state: (shown) => this.stateOf(shown),
            ask: this.ask,
          },
          view,
        ),
      };
    return this.read.model;
  }

  private percent(value: number): string {
    return `${formatNumber(this.hass, value, { digits: 0 })} %`;
  }

  protected tone(view: EntityView): Tone {
    return this.model(view).tone;
  }

  protected active(view: EntityView): boolean {
    return !this.model(view).off;
  }

  /**
   * What it is doing, as its card says it (how far its valve is open beside the word, where the card asks), and the
   * room's humidity where a climate measures it: "Heating · 42 % · 46 % RH".
   */
  protected status(view: EntityView): Status {
    const valve = valveOf(this.hass, view, this.ask);
    const humidity = humidityOf(this.hass, view, this.ask);
    this.follows(this.ask.state_entity);
    this.follows(humidity?.entity);
    return {
      parts: [
        this.model(view).doing.text,
        valve ? this.percent(valve.value) : '',
        humidity ? `${this.percent(humidity.value)} RH` : '',
      ],
    };
  }

  /**
   * What the opening card asked to be read, a row each where it is known: how far the valve is open, the window or the
   * door by it (open, in the warning ink), the battery (low, in the warning ink). What they read is followed.
   */
  private readings(view: EntityView, unusable: boolean): SheetRow[] {
    const valve = valveOf(this.hass, view, this.ask);
    const window = windowBy(this.hass, view, this.ask);
    const battery = batteryLevel(this.hass, view, this.ask);
    for (const read of [valve, window, battery]) this.follows(read?.entity);
    const row = (icon: IconRef, title: string, value: string, ink = ''): SheetRow => ({
      kind: 'control',
      icon,
      title,
      disabled: unusable,
      control: html`<span class="fv-row__value ${ink}">${value}</span>`,
      end: this.ruler.width('fv-row__value', value),
    });
    return [
      ...(valve ? [row('drop', this.t('sheets.valve'), this.percent(valve.value))] : []),
      ...(window
        ? [
            row(
              window.door
                ? window.open
                  ? 'doorOpen'
                  : 'door'
                : window.open
                  ? 'windowOpen'
                  : 'window',
              this.t(window.door ? 'sheets.door' : 'sheets.window'),
              this.t(window.open ? 'common.open' : 'common.closed'),
              window.open ? 'fv-row__value--warning' : 'fv-row__value--quiet',
            ),
          ]
        : []),
      ...(battery
        ? [
            row(
              'battery',
              this.t('sheets.battery'),
              this.percent(battery.value),
              battery.value <= LOW_BATTERY ? 'fv-row__value--warning' : '',
            ),
          ]
        : []),
    ];
  }

  /** The day's line is what it measures: the room's temperature, the tank's, the air's humidity. */
  protected daySpec(view: EntityView): DaySpec {
    const m = this.model(view);
    return {
      kind: 'value',
      attribute: m.kind === 'humidifier' ? 'current_humidity' : 'current_temperature',
      unit: m.unit,
      digits: m.unit === '%' ? 0 : 1,
    };
  }

  protected dayLevel(view: EntityView): number | null {
    return this.model(view).current ?? null;
  }

  private setTarget(view: EntityView, m: ThermostatModel, detail: DialChangeDetail): void {
    const call = targetCall(m, detail);
    if (call) this.call(m.kind, call[0], call[1], view.id);
  }

  /** The target as the device reports it, or the one the keys stepped to while it has not. */
  private target(m: ThermostatModel): DialChangeDetail | null {
    const reported: DialChangeDetail | null =
      m.low !== undefined && m.high !== undefined
        ? { low: m.low, high: m.high }
        : m.target !== undefined
          ? { value: m.target }
          : null;
    return this.stepped.read(reported, sameTarget);
  }

  /** The end of a range the keys step now. */
  private end(m: ThermostatModel): 0 | 1 {
    return this.rangeEnd ?? (m.action === 'cooling' ? 1 : 0);
  }

  /** One step of the target, or of a range's end, from the keys: shown at once, sent once the taps stop. */
  private step(view: EntityView, direction: 1 | -1): void {
    const m = this.model(view);
    const shown = this.target(m);
    if (!shown || m.off) return;
    const next = stepTarget(shown, direction, m, this.end(m));
    this.stepped.set(next);
    this.burst.push(() => this.setTarget(view, m, next));
  }

  /** The dial moved: the keys step the end of a range it moved last, and what they stepped to gives way to it. */
  private dialled(shown: DialChangeDetail | null, detail: DialChangeDetail): void {
    if (detail.low !== undefined && detail.high !== undefined)
      this.rangeEnd = detail.high !== shown?.high ? 1 : 0;
    this.stepped.clear();
  }

  /**
   * The words over a target's ruler, `length` long: its ends' figures and, where it measures something, what it
   * reads now at its place on the scale ("15° · Now 20.8° · 30°"). Where the reading would run into an end's figure
   * it stands in that end's place; where the ruler holds no reading beside an end, the ends alone.
   */
  private scaleWords(
    m: ThermostatModel,
    length: number,
    edge: (value: number) => string,
    now: string,
  ): Labels {
    const low: Labels[number] = [0, edge(m.min)];
    const high: Labels[number] = [1, edge(m.max)];
    if (!now || m.current === undefined) return [low, high];
    const at = clamp((m.current - m.min) / (m.max - m.min), 0, 1);
    const marked: Labels = [low, [at, now], high];
    if (at > 0 && at < 1 && axisHolds(this.ruler, length, marked)) return marked;
    const [start, end] = at < 0.5 ? [now, high[1]] : [low[1], now];
    return endsHold(this.ruler, length, start, end)
      ? [
          [0, start],
          [1, end],
        ]
      : [low, high];
  }

  /**
   * The target on a ruler across the sheet (#258): one row for a target, two for a range, its low end over its high
   * one — each end's figure a button, the one the keys step in the accent's ink — and one that says "Off" at rest
   * while the thermostat is off.
   */
  private renderAcross(
    view: EntityView,
    m: ThermostatModel,
    name: string,
    shown: DialChangeDetail | null,
    idle: boolean,
    unusable: boolean,
    figure: (value: number) => string,
    edge: (value: number) => string,
    now: string,
  ): TemplateResult {
    const off = this.t('climate.mode.off');
    const sign = m.unit === '%' ? ' %' : '°';
    const row = {
      name,
      glyph: 'thermo',
      text: unusable ? undefined : m.off ? off : undefined,
      words: m.canOff ? [off] : [],
      unit: m.unit,
      min: m.min,
      max: m.max,
      step: m.step,
      tone: idle ? ('neutral' as const) : m.tone,
      inactive: m.off || !shown,
      disabled: idle,
      format: figure,
      edge: (value: number): string => `${figure(value)}${sign}`,
      labels: (length: number): Labels => this.scaleWords(m, length, edge, now),
    };
    const send = (next: DialChangeDetail): void => {
      this.stepped.set(next);
      this.setTarget(view, m, next);
    };
    const { low, high } = shown ?? {};
    if (m.off || low === undefined || high === undefined)
      return this.across({
        ...row,
        title: this.t('climate.target'),
        value: unusable ? null : (shown?.value ?? null),
        change: (value) => send({ value }),
      });
    const end = this.end(m);
    const one = (index: 0 | 1, value: number): TemplateResult =>
      this.across({
        ...row,
        key: index ? 'high' : '',
        title: this.t(index ? 'climate.high' : 'climate.low'),
        value: unusable ? null : value,
        ...(idle
          ? {}
          : {
              end: {
                on: index === end,
                choose: () => {
                  this.rangeEnd = index;
                  this.requestUpdate();
                },
              },
            }),
        change: (next) => {
          // the other end as it stands now (one may be set right after the other), taken along where this one passes it
          const { low: floor = low, high: ceiling = high } = this.target(m) ?? {};
          this.rangeEnd = index;
          send(
            index
              ? { low: Math.min(next, floor), high: next }
              : { low: next, high: Math.max(next, ceiling) },
          );
        },
      });
    return html`${one(0, low)} ${one(1, high)}`;
  }

  /** Its preset, its fan speed and its swing, each where the climate lists some. */
  private rows(view: EntityView, unusable: boolean): SheetRow[] {
    return ROWS.flatMap((row): SheetRow[] => {
      const options = listAttr(view.attr(row.list));
      if (!options.length) return [];
      let hold = this.chosen.get(row.attribute);
      if (!hold) this.chosen.set(row.attribute, (hold = new Hold<string | null>(this)));
      const held = hold;
      return [
        {
          kind: 'choice',
          icon: row.icon,
          title: this.t(row.title),
          chosen: held.read(view.attr<string | null>(row.attribute) ?? null),
          options,
          word: (option) => modeWord(this.rawHass, view, row.attribute, option),
          disabled: unusable,
          choose: (option) => {
            held.set(option);
            this.call('climate', row.service, { [row.attribute]: option }, view.id);
          },
        },
      ];
    });
  }

  protected renderBody(view: EntityView, unusable: boolean): TemplateResult {
    const name = this.nameFor(view, undefined);
    const m = this.model(view);
    const percent = m.unit === '%';
    const digits = m.step < 1 ? 1 : 0;
    const figure = (value: number): string =>
      formatNumber(this.hass, value, { digits, minDigits: digits });
    const edge = (value: number): string =>
      `${formatNumber(this.hass, value, { digits: 0 })}${percent ? ' %' : '°'}`;
    const now =
      m.current === undefined
        ? ''
        : this.t('climate.current', {
            value: percent
              ? `${formatNumber(this.hass, m.current, { digits: 0 })} %`
              : `${formatNumber(this.hass, m.current, { digits: 1 })}°`,
          });
    const shown = this.target(m);
    const idle = unusable || m.off || !shown;
    const target = this.t('climate.target');
    const modes = modesDrawn(m);
    return html`${
      this.dial
        ? html`<div class="dt-hero">
            <fluvy-dial
              .radius=${this.ring}
              .large=${this.large}
              .stepper=${false}
              .tone=${idle ? 'neutral' : m.tone}
              .min=${m.min}
              .max=${m.max}
              .step=${m.step}
              .arc=${m.arc}
              .value=${shown?.value}
              .low=${shown?.low}
              .high=${shown?.high}
              .current=${m.current}
              .unit=${m.unit}
              .sub=${this.dialWords(now)}
              .text=${unusable ? '—' : m.off ? this.t('climate.mode.off') : shown ? undefined : '—'}
              .name=${`${name} · ${target}`}
              min-label=${edge(m.min)}
              max-label=${edge(m.max)}
              ?disabled=${idle}
              .format=${figure}
              @fluvy-input=${(event: CustomEvent<DialChangeDetail>) =>
                this.dialled(shown, event.detail)}
              @fluvy-change=${(event: CustomEvent<DialChangeDetail>) => {
                this.dialled(shown, event.detail);
                this.setTarget(view, m, event.detail);
              }}
            ></fluvy-dial>
          </div>`
        : this.renderAcross(view, m, name, shown, idle, unusable, figure, edge, now)
    }
    ${keys(
      [
        {
          key: 'down',
          glyph: 'minus',
          label: `${name} · ${target} · ${this.t('common.decrease')}`,
          step: -1,
          disabled: idle,
        },
        {
          key: 'up',
          glyph: 'plus',
          label: `${name} · ${target} · ${this.t('common.increase')}`,
          step: 1,
          disabled: idle,
        },
      ],
      this.room,
      () => undefined,
      (direction) => this.step(view, direction),
    )}
    ${
      modes.length
        ? html`${label(this.t('climate.mode'))}${chipRow(
            modes.map((mode) => modeChoice({ ...mode, unavailable: unusable })),
            (key) => {
              this.stepped.clear();
              chooseMode(this.controlHost, view, m, key);
            },
            'full',
            { ruler: this.ruler, width: this.room },
          )}`
        : nothing
    }
    ${sheetRows(this.ruler, this.room, [
      ...this.readings(view, unusable),
      ...(m.kind === 'climate' ? this.rows(view, unusable) : []),
    ])}`;
  }
}

if (!customElements.get('fluvy-details-climate'))
  customElements.define('fluvy-details-climate', FluvyDetailsClimate);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-details-climate': FluvyDetailsClimate;
  }
}
