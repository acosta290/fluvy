import {
  clock12,
  dateFormat,
  formatNumber,
  houseZone,
  languageOf,
  speaks,
  stateText,
  strings,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
  type UnsubscribeFunc,
} from '@fluvy/core';

import { firstFit, glyph, ico, listRow, sheetStyles, textWidth, type Tone } from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { Card } from '../shared/base.js';

import {
  entityField,
  fieldRow,
  formLabels,
  numberField,
  selectField,
  textField,
} from '../shared/form.js';

import { compassKey, conditionGlyph, isCondition } from '../shared/weather.js';

const s = strings('weather');

type ForecastType = 'daily' | 'hourly';
export type ForecastMode = ForecastType | 'both' | 'none';

export interface WeatherCardConfig extends FluvyCardConfig {
  /** What to draw under the hero: day rows (default), hour columns, both as the design sheet shows them, or nothing. */
  forecast?: ForecastMode;
  /** Day rows (1–10, default 5). Hour columns are decided by the card's width. */
  days?: number;
  /** Test hook: an ISO date that freezes "now" (day labels, the hours ahead). Undocumented. */
  _now?: string;
}

/** One entry of `weather/subscribe_forecast`; every field but `datetime` may be absent or null. */
interface ForecastItem {
  readonly datetime: string;
  readonly condition?: string | null;
  readonly temperature?: number | null;
  readonly templow?: number | null;
  readonly precipitation_probability?: number | null;
  readonly precipitation?: number | null;
}

/** `undefined` = asked, not answered yet (the strip keeps its room); `null` = this entity has no such forecast. */
type Forecasts = Partial<Record<ForecastType, readonly ForecastItem[] | null>>;

interface Subscription {
  cancelled: boolean;
  unsubscribe?: UnsubscribeFunc;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HOUR_COLUMN = 64; // the sheet's hour column: five of them in a 320 column
const ROW = 60;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const dayOf = (date: Date): number =>
  date.getFullYear() * 10_000 + date.getMonth() * 100 + date.getDate();
const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Home Assistant's unsubscribe answers with a promise that rejects when the socket is already gone. */
function release(subscription: Subscription): void {
  subscription.cancelled = true;
  try {
    void Promise.resolve(subscription.unsubscribe?.()).catch(() => undefined);
  } catch {
    /* nothing left to release */
  }
}

/**
 * The weather hero: the condition as a 64 icon circle, the temperature at readout `l`, one line of
 * context, and the forecast underneath — hour columns, day rows, or both as the sheet draws them.
 *
 * The forecast is not an attribute any more: the card subscribes to `weather/subscribe_forecast`
 * once per type and releases every subscription on disconnect and whenever the entity or the mode
 * changes. An entity that does not offer a type answers with an error, and that strip stays away.
 */
export class FluvyWeatherCard extends Card<WeatherCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.ambient,
    css`
      /* the lab fixes the sheet at 360; a dashboard column decides here */
      .am-card {
        width: 100%;
      }
      /* same 88 box as the sheet (readout 64 beside the 64 circle, then 4 + the 20 sub), but the sub runs
         under the circle too: "Sensación 16° · Viento 12 km/h NO" has to fit a 260 column */
      .am-weather__hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 64px;
        column-gap: 12px;
        align-content: start;
      }
      .am-weather__hero--bare {
        height: 64px;
      }
      .am-weather__now {
        min-width: 0;
      }
      .am-weather__hero > .fv-card__sub {
        grid-column: 1 / -1;
        margin-top: 4px;
      }
      /* "Barcelona El Prat · Partly cloudy": the name may ellipsize, the condition never (and a name with no room left steps aside: see renderCard) */
      .am-weather__label {
        display: flex;
        min-width: 0;
        white-space: pre;
      }
      .am-weather__name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .am-weather__condition {
        flex: none;
      }
      .am-hours {
        grid-template-columns: repeat(var(--am-hours, 5), var(--am-hour-w, minmax(0, 1fr)));
        justify-content: center;
      } /* cells on the 4 grid: every glyph on a whole pixel */
      .am-days > .fv-skeleton {
        border-radius: var(--fluvy-radius-control);
      }
    `,
  ];

  static override properties = { ...Card.properties, forecasts_: { state: true } };

  declare forecasts_: Forecasts;

  private subscriptions: Subscription[] = [];
  /** What the live subscriptions are for, and what `forecasts_` was answered for: `entity|types`. */
  private subscribedKey = '';
  private dataKey = '';

  constructor() {
    super();
    this.forecasts_ = {};
  }

  static override getConfigForm(): LovelaceConfigForm {
    const shared = formLabels({
      entity: 'editor.weather',
      days: 'editor.days',
    });
    return {
      schema: [
        entityField(['weather']),
        textField('name'),
        fieldRow(
          selectField('forecast', ['daily', 'hourly', 'both', 'none']),
          numberField('days', 1, 10),
        ),
      ],
      computeLabel: (schema, localize) =>
        schema.name === 'forecast'
          ? s({ language: document.documentElement.lang || 'en' }, 'editor.forecast')
          : shared.computeLabel?.(schema, localize),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): WeatherCardConfig {
    return {
      type: 'custom:fluvy-weather-card',
      entity: entities.find((id) => id.startsWith('weather.')) ?? '',
    };
  }

  protected override prepare(config: WeatherCardConfig): WeatherCardConfig {
    if (!config.entity) throw new Error('fluvy-weather-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    const mode = this.mode();
    const rows = mode === 'daily' || mode === 'both' ? this.dayCount() : 0;
    return Math.ceil(
      (128 + (mode === 'hourly' || mode === 'both' ? 100 : 0) + (rows ? 16 + rows * ROW : 0)) / 50,
    );
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /** The sun tells day from night for the whole instance; the condition is the fallback. */
  protected override watched(): readonly string[] {
    return [this.config?.entity ?? '', 'sun.sun'];
  }

  private mode(): ForecastMode {
    const mode = this.config?.forecast;
    return mode === 'hourly' || mode === 'both' || mode === 'none' ? mode : 'daily';
  }

  private dayCount(): number {
    return Math.min(10, Math.max(1, Math.round(this.config?.days ?? 5)));
  }

  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  /* ---------- forecast subscriptions ---------- */

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.requestUpdate(); // moved in the DOM: `willUpdate` subscribes again
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribeAll();
  }

  /** Runs before every render — the one place where state may still change without costing a second render. */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const entityId = this.config?.entity ?? '';
    const mode = this.mode();
    const types: readonly ForecastType[] =
      mode === 'both' ? ['hourly', 'daily'] : mode === 'none' ? [] : [mode];
    const live = this.isConnected && this.hass !== undefined && this.entity().status !== 'missing';
    const key = live && types.length > 0 ? `${entityId}|${types.join('+')}` : '';
    if (key === this.subscribedKey) return;

    this.unsubscribeAll();
    this.subscribedKey = key;
    if (key !== this.dataKey) {
      this.forecasts_ = {};
      this.dataKey = key;
    } // a reconnect keeps what it was showing
    for (const type of types) if (key) this.subscribe(entityId, type);
  }

  private subscribe(entityId: string, type: ForecastType): void {
    const connection = this.hass?.connection;
    if (!connection) return;
    const subscription: Subscription = { cancelled: false };
    this.subscriptions.push(subscription);
    const answer = (items: readonly ForecastItem[] | null): void => {
      if (!subscription.cancelled) this.forecasts_ = { ...this.forecasts_, [type]: items };
    };
    connection
      .subscribeMessage<{ forecast?: readonly ForecastItem[] | null }>(
        (message) => answer(Array.isArray(message?.forecast) ? message.forecast : null),
        { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: entityId },
      )
      .then((unsubscribe) => {
        subscription.unsubscribe = unsubscribe;
        if (subscription.cancelled) release(subscription); // the card left, or changed entity, while the socket was answering
      })
      .catch(() => answer(null)); // the entity does not offer this forecast: no strip, no noise
  }

  private unsubscribeAll(): void {
    for (const subscription of this.subscriptions) release(subscription);
    this.subscriptions = [];
    this.subscribedKey = '';
  }

  /* ---------- facts ---------- */

  /**
   * Never a sun at night. `sun.sun` decides when the instance has it — and dates the hours ahead from
   * its next rising and setting, each taken back a day at a time to the latest one before `at`.
   * Without it, only the condition itself (`clear-night`) can say so.
   */
  private nightAt(at: number, now: number): boolean {
    const sun = this.hass?.states['sun.sun'];
    if (!sun || (sun.state !== 'below_horizon' && sun.state !== 'above_horizon')) return false;
    const rising = Date.parse(String(sun.attributes['next_rising'] ?? ''));
    const setting = Date.parse(String(sun.attributes['next_setting'] ?? ''));
    if (at <= now || !Number.isFinite(rising) || !Number.isFinite(setting))
      return sun.state === 'below_horizon';
    const latest = (event: number): number => event - Math.ceil((event - at) / DAY_MS) * DAY_MS;
    return latest(setting) > latest(rising);
  }

  /**
   * fluvy's wording in the languages it ships; Home Assistant's own translation elsewhere; and for a
   * condition outside the fifteen (a custom integration), the raw word made presentable. A clear sky
   * after dark is "Clear" beside its moon, whatever the integration calls it.
   */
  private conditionText(condition: string | null | undefined, night = false): string {
    const key = condition === 'sunny' && night ? 'clear-night' : (condition ?? '');
    if (!key) return '';
    const stateObj = this.entity().stateObj;
    if (!speaks(languageOf(this.hass)) && stateObj && this.hass?.formatEntityState) {
      try {
        return capitalise(this.hass.formatEntityState(stateObj, key));
      } catch {
        /* fall through */
      }
    }
    return isCondition(key) ? s(this.hass, key) : capitalise(key.replace(/[-_]/g, ' '));
  }

  private unit(): string {
    return (
      this.entity().attr<string | null>('temperature_unit') ??
      this.hass?.config?.unit_system?.temperature ??
      '°C'
    );
  }

  /** Whole degrees for anything forecast or felt; the measured temperature keeps its decimal. */
  private degrees(value: unknown, digits = 0): string | null {
    return isNumber(value) ? formatNumber(this.hass, value, { digits }) : null;
  }

  private bearing(value: unknown): string {
    if (typeof value === 'string' && value.trim() && Number.isNaN(Number(value)))
      return value.trim().toUpperCase();
    const degrees = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(degrees))
      return '';
    return s(this.hass, compassKey(degrees));
  }

  /** "Feels 16° · Wind 12 km/h NW" — humidity stands in for whichever of the two the entity does not report. */
  private contextLine(): string {
    const view = this.entity();
    const parts: string[] = [];
    const feels = this.degrees(view.attr('apparent_temperature'));
    if (feels !== null) parts.push(s(this.hass, 'feels', { value: `${feels}°` }));
    const speed = view.attr('wind_speed');
    if (isNumber(speed)) {
      const direction = this.bearing(view.attr('wind_bearing'));
      const unit = view.attr<string | null>('wind_speed_unit') ?? 'km/h';
      parts.push(
        `${this.t('weather.wind')} ${formatNumber(this.hass, speed, { digits: 0 })} ${unit}${direction ? ` ${direction}` : ''}`,
      );
    }
    const humidity = view.attr('humidity');
    if (parts.length < 2 && isNumber(humidity))
      parts.push(
        `${this.t('weather.humidity')} ${formatNumber(this.hass, humidity, { digits: 0 })} %`,
      );
    return parts.join(' · ');
  }

  /* ---------- forecast strips ---------- */

  private dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const zone = houseZone(this.hass);
    return dateFormat(this.hass?.language ?? 'en', zone ? { ...options, timeZone: zone } : options);
  }

  /** The hour alone — "22" on a 24 h clock, "10 PM" on a 12 h one: a 64 column has no room for "22:00". */
  private hourLabel(date: Date): string {
    const twelve = clock12(this.hass);
    return this.dateFormat(
      twelve ? { hour: 'numeric', hourCycle: 'h12' } : { hour: '2-digit', hourCycle: 'h23' },
    ).format(date);
  }

  private renderHours(
    items: readonly ForecastItem[] | null | undefined,
  ): TemplateResult | typeof nothing {
    if (items === undefined) return html`<div class="am-hours fv-skeleton"></div>`;
    const now = this.now().getTime();
    const columns = Math.max(3, Math.min(6, Math.floor(this.contentWidth / HOUR_COLUMN)));
    const ahead = (items ?? [])
      .map((item) => ({ item, at: Date.parse(item.datetime) }))
      .filter(({ at }) => Number.isFinite(at) && at > now - HOUR_MS)
      .slice(0, columns);
    if (ahead.length === 0) return nothing;
    const cell = Math.floor(this.contentWidth / columns / 4) * 4;
    return html`<div class="am-hours" style="--am-hours:${columns};--am-hour-w:${cell}px">
      ${ahead.map(({ item, at }, index) => {
        const value = this.degrees(item.temperature);
        const dark = this.nightAt(at, now);
        return html`<div
          class="am-hour"
          title=${this.conditionText(item.condition, dark) || nothing}
        >
          <span class="am-hour__t"
            >${index === 0 && at <= now + HOUR_MS ? this.t('common.now') : this.hourLabel(new Date(at))}</span
          >
          ${glyph(conditionGlyph(item.condition ?? '', dark))}
          <span class="am-hour__v">${value === null ? '—' : `${value}°`}</span>
        </div>`;
      })}
    </div>`;
  }

  /**
   * "Showers · 60 %", or the amount when the integration forecasts millimetres instead of a chance.
   * The chance is the optional half: in a row too narrow for both, the condition stays whole.
   */
  private dayDetail(item: ForecastItem, room: number, font: string): string {
    const condition = this.conditionText(item.condition);
    const chance = item.precipitation_probability;
    const amount = item.precipitation;
    const rain = isNumber(chance)
      ? chance >= 10
        ? `${formatNumber(this.hass, chance, { digits: 0 })} %`
        : ''
      : isNumber(amount) && amount > 0
        ? `${formatNumber(this.hass, amount, { digits: 1 })} ${this.entity().attr<string | null>('precipitation_unit') ?? 'mm'}`
        : '';
    return condition && rain
      ? firstFit([`${condition} · ${rain}`, condition], room, font)
      : condition || rain;
  }

  /** Beside the hour columns the rows start tomorrow (the hours are today), as the sheet draws them. */
  private renderDays(
    items: readonly ForecastItem[] | null | undefined,
    afterToday: boolean,
  ): TemplateResult | typeof nothing {
    const count = this.dayCount();
    if (items === undefined)
      return html`<div class="am-days">
        <div class="fv-skeleton" style="height:${count * ROW}px"></div>
      </div>`;
    const today = dayOf(this.now());
    const weekday = this.dateFormat({ weekday: 'long' });
    const dated = (items ?? [])
      .map((item) => ({ item, date: new Date(item.datetime) }))
      .filter(({ date }) => !Number.isNaN(date.getTime()) && dayOf(date) >= today);
    const later = dated.filter(({ date }) => dayOf(date) > today);
    const days = (afterToday && later.length > 0 ? later : dated).slice(0, count);
    if (days.length === 0) return nothing;
    const family = getComputedStyle(this).fontFamily;
    return html`<div class="am-days">
      ${days.map(({ item, date }) => {
        const high = this.degrees(item.temperature);
        const low = this.degrees(item.templow);
        const value = high === null ? '—' : low === null ? `${high}°` : `${high}° / ${low}°`;
        // the row: 44 circle + 12, the text, 12 + the value; 4 px of margin for a fallback face
        const room = this.contentWidth - 56 - 12 - textWidth(value, `600 16px ${family}`) - 4;
        return listRow({
          icon: conditionGlyph(item.condition ?? '', false), // a day row is the day's weather: neutral, never the night face
          tone: 'neutral',
          title: dayOf(date) === today ? this.t('common.today') : capitalise(weekday.format(date)),
          sub: this.dayDetail(item, room, `500 13px ${family}`),
          trailing: 'value',
          value,
        });
      })}
    </div>`;
  }

  /* ---------- render ---------- */

  protected renderCard(): TemplateResult {
    const view = this.entity();
    if (view.status === 'missing')
      return this.renderEmpty(
        this.config?.entity
          ? `${this.config.name ?? view.name} · ${stateText(this.hass, view)}`
          : undefined,
      );

    const usable = view.status !== 'unavailable';
    const known = view.status === 'ok';
    const now = this.now().getTime();
    const night = known && (view.state === 'clear-night' || this.nightAt(now, now));
    const condition = known ? this.conditionText(view.state, night) : stateText(this.hass, view);
    const tone: Tone = !usable ? 'off' : !known ? 'neutral' : night ? 'accent' : 'solar';
    const value = usable ? this.degrees(view.attr('temperature'), 1) : null;
    const context = usable ? this.contextLine() : '';
    const mode = this.mode();

    // the label is 11/600 uppercase at 0.06 em; the name keeps its place while at least 64 px of it would show
    const name = this.config?.name ?? view.name;
    const font = `600 11px ${getComputedStyle(this).fontFamily}`;
    const labelWidth = (text: string): number =>
      textWidth(text.toLocaleUpperCase(), font) + text.length * 0.66;
    const nameRoom = this.contentWidth - 76 - labelWidth(` · ${condition}`);
    const named = nameRoom >= Math.min(64, labelWidth(name) + 2);

    return html`<article class="fv-card am-card ${usable ? '' : 'is-off'}" data-card>
      <div class="am-weather__hero ${context ? '' : 'am-weather__hero--bare'}">
        <div class="am-weather__now">
          <div class="fv-readout fv-readout--l">
            <p class="fv-readout__label am-weather__label">
              ${named ? html`<span class="am-weather__name">${name}</span>` : nothing}<span
                class="am-weather__condition"
                >${named ? ' · ' : ''}${condition}</span
              >
            </p>
            <p class="fv-readout__value">
              <span>${value ?? '—'}</span
              >${value === null ? nothing : html`<span class="fv-unit">${this.unit()}</span>`}
            </p>
          </div>
        </div>
        ${ico(
          this.config?.icon ?? (usable ? conditionGlyph(known ? view.state : '', night) : 'ban'),
          tone,
          {
            hero: true,
            label: condition,
            onTap: () => this.tap(view.id, { action: 'more-info' }),
          },
        )}
        ${context ? html`<p class="fv-card__sub">${context}</p>` : nothing}
      </div>
      ${usable && (mode === 'hourly' || mode === 'both') ? this.renderHours(this.forecasts_.hourly) : nothing}
      ${usable && (mode === 'daily' || mode === 'both') ? this.renderDays(this.forecasts_.daily, mode === 'both') : nothing}
    </article>`;
  }
}
