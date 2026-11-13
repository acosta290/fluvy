/**
 * Fluvy's history in Home Assistant's details dialog (1.20, #162): in place of the dialog's own history block, the
 * house's chart — a head with what the window says (a meter's day so far, a measure's change), chips for the window
 * (the house's, a day, a week), the chart in the house's style read by hand, what the window reached, and the way on to
 * the History page with the same window. A measure is its line through time; a meter (`total`, `total_increasing`)
 * what it gained each hour (each day over longer windows) or its running total, which breaks where it was reset;
 * anything else the stretches it spent in each state. Read as Home Assistant's own block reads: the recorder's
 * five-minute statistics where it keeps them, its states where not; drawn again every minute and at every change of the
 * entity, which its last reading always is.
 */
// the block's words first: they are here before anything in its chunk says them
import './english.js';
import {
  chartDefaults,
  dateFormat,
  formatTime,
  languageOf,
  localize,
  markLanguage,
  onWords,
  plural,
  resolveEntity,
  stateText,
  stepAside,
  strings,
  type EntityView,
  type HomeAssistant,
  type KeyOf,
} from '@fluvy/core';
import {
  axis,
  baseStyles,
  chips,
  emptyState,
  glyph,
  head,
  motionPreference,
  readout,
  reducedMotion,
  type ChipItem,
} from '@fluvy/ui';
import { html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';

import { historyReadings } from '../chart/data/sources.js';
import { remember, statisticsDuring } from '../chart/data/statistics.js';
import { roundGrid, type Grid } from '../chart/data/slots.js';
import { dayStart, readSlots } from '../chart/data/span.js';
import {
  chartBubble,
  chartStyles,
  drawRead,
  isBars,
  plotOf,
  quarterTicks,
  readAt,
  readingsOf,
  resolveStyle,
  scrub,
  ScrubController,
  slotTicks,
  stretchTone,
  tickText,
  timeLine,
  windowWord,
  type ChartSpec,
  type Reading,
} from '../chart/engine/index.js';
import { HeadFit, type FittedHead } from '../energy/head.js';
import { axisHolds } from '../shared/axis.js';
import { fittedColumns } from '../shared/chips.js';
import { spanText } from '../shared/duration.js';
import { LaidWidth } from '../shared/laid.js';
import { statsRow } from '../shared/readouts.js';
import { Refresher } from '../shared/refresh.js';
import { MINUTE, Ticker } from '../shared/ticker.js';
import { figure, precisionOf, type Scale } from '../shared/units.js';
import {
  breakAt,
  bucketsOf,
  DAY,
  gainedOf,
  gainedSince,
  gainsIn,
  gainSince,
  HOUR,
  kindOf,
  lastState,
  linePeriod,
  meansOf,
  PERIOD,
  reachOf,
  resetsOf,
  slotOf,
  stretchAt,
  stretchesOf,
  timeOn,
  totalsOf,
  windowsOf,
  type Gained,
  type Kind,
  type Laid,
  type Read,
  type Recorded,
  type Stretch,
} from './reads.js';
import { detailsStyles } from './styles.js';

const s = strings('details', 'common');
type DetailsKey = KeyOf<'details' | 'common'>;

/** A meter's reading: what it gained in each slot, or its running total. */
export type Mode = 'gains' | 'total';

/** Where a reading came from: the recorder's five-minute statistics, its hour's, or the states themselves. */
type Source = '5minute' | 'hour' | 'states';

/** What the recorder answered for a window. */
type Answer =
  | { readonly kind: 'measure'; readonly readings: readonly Read[]; readonly source: Source }
  | { readonly kind: 'counter'; readonly buckets: readonly Gained[]; readonly source: Source }
  | { readonly kind: 'states'; readonly rows: readonly Recorded[] };

/** An answer, with what it was asked for: its entity, its window (hours) and its kind. */
interface Shown {
  readonly key: string;
  readonly hours: number;
  readonly answer: Answer;
}

/** The chart's height: the bubble's 44 over the plot, 8 under its floor; a band of states 32 under the same 44. */
const CHART_HEIGHT = 168;
const BAND_HEIGHT = 76;
const HEADROOM = 44;
/** The block's content before its first layout: a phone's dialog (360) less Home Assistant's 24 sides. */
const FIRST_WIDTH = 312;
/** HA's frontend never sets it on a meter that only grows: what a fall means. */
const INCREASING = 'total_increasing';

/** The window chosen last on this page: the next dialog opens on it, where its chips offer it. */
let chosen: number | undefined;

/** A measure's readings over a window: the recorder's means where it keeps statistics, its states where not. */
async function readMeasure(
  hass: HomeAssistant,
  id: string,
  window: { readonly start: number; readonly end: number },
  hours: number,
  statistics: boolean,
): Promise<Answer> {
  const period = linePeriod(hours);
  if (statistics) {
    const rows = await statisticsDuring(hass, {
      ids: [id],
      ...window,
      period,
      types: ['mean', 'min', 'max'],
    }).catch(() => ({}) as Record<string, never>);
    const readings = meansOf(rows[id] ?? []);
    if (readings.length) return { kind: 'measure', readings, source: period };
  }
  const readings = await historyReadings(hass, id, window.start, window.end).catch(() => []);
  return { kind: 'measure', readings, source: 'states' };
}

/**
 * A meter's buckets from `from` (its day's midnight, or its window's first slot) to now: statistics, else its states.
 */
async function readCounter(
  hass: HomeAssistant,
  id: string,
  window: { readonly start: number; readonly end: number },
  period: '5minute' | 'hour',
  increase: boolean,
): Promise<Answer> {
  const rows = await statisticsDuring(hass, {
    ids: [id],
    ...window,
    period,
    types: ['change', 'state'],
  }).catch(() => ({}) as Record<string, never>);
  const buckets = gainedOf(rows[id] ?? []);
  if (buckets.length) return { kind: 'counter', buckets, source: period };
  const readings = await historyReadings(hass, id, window.start, window.end).catch(() => []);
  return { kind: 'counter', buckets: bucketsOf(readings, increase), source: 'states' };
}

/** A thing's states over a window, as Home Assistant's history keeps them (five minutes for every block that asks). */
function readStates(
  hass: HomeAssistant,
  id: string,
  window: { readonly start: number; readonly end: number },
): Promise<Answer> {
  const key = `states|${id}|${Math.floor(window.start / MINUTE)}|${Math.floor(window.end / (5 * MINUTE))}`;
  return remember(key, () =>
    hass.callWS<Record<string, Recorded[]>>({
      type: 'history/history_during_period',
      start_time: new Date(window.start).toISOString(),
      end_time: new Date(window.end).toISOString(),
      entity_ids: [id],
      minimal_response: true,
      no_attributes: true,
    }),
  )
    .catch(() => ({}) as Record<string, never>)
    .then((rows): Answer => ({ kind: 'states', rows: rows?.[id] ?? [] }));
}

export class FluvyDetailsHistory extends LitElement {
  // the engine's sheet for a chart drawn in the house's style
  static override styles = [...baseStyles, chartStyles, detailsStyles];

  static override properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    hours: { attribute: false },
    mode: { attribute: false },
    now: { attribute: false },
    shown: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string | undefined;
  /**
   * The window shown, in hours; none: the one chosen last on this page, else the house's (Charts, 12 from the factory).
   */
  declare hours: number | undefined;
  /** A meter's reading: what it gained each hour (each day), or its running total. */
  declare mode: Mode;
  /** A frozen clock (a sheet's, a test's), in ms; none: the page's. */
  declare now: number | undefined;
  /** What the recorder answered; undefined while it is asked. */
  declare shown: Shown | undefined;

  private readonly scrubber = new ScrubController(this);
  /** The head's fitting and the text ruler every fitting of the block shares (measured again when a font lands). */
  private readonly headFit = new HeadFit(this);
  private readonly reads = new Refresher<Shown>(MINUTE);
  private offWords: (() => void) | undefined;

  constructor() {
    super();
    this.mode = 'gains';
    // the block is drawn for the width it was laid out at, and again when the dialog's changes it (a phone turned)
    new LaidWidth(
      this,
      () => this,
      () => this.clientWidth,
    );
    // the window rolls on with the clock: every minute it is drawn again and the recorder asked again, as Home
    // Assistant's own block is
    new Ticker(this, () => this.now === undefined);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // a language's words arriving (fetched after the first paint) draw the block again in them
    this.offWords = onWords(() => this.requestUpdate());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.offWords?.();
    this.offWords = undefined;
  }

  /**
   * Home Assistant hands the dialog a new `hass` at every change in the house: the block draws again for its own
   * entity.
   */
  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    const before = changed.get('hass') as HomeAssistant | undefined;
    if (changed.size !== 1 || !before || !this.hass || !this.entityId) return true;
    return (
      before.states[this.entityId] !== this.hass.states[this.entityId] ||
      before.language !== this.hass.language ||
      before.locale !== this.hass.locale ||
      before.themes?.darkMode !== this.hass.themes?.darkMode ||
      before.entities?.[this.entityId] !== this.hass.entities?.[this.entityId]
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const hass = this.hass;
    if (changed.has('entityId')) this.scrubber.set(null);
    if (!hass || !this.entityId) return;
    markLanguage(this, hass.language);
    this.toggleAttribute('dark', hass.themes?.darkMode ?? false);
    this.toggleAttribute('reduced-motion', motionPreference() === 'reduced' || reducedMotion());
    this.ask(hass, this.entityId);
  }

  /** The window chips offer, and the one shown. */
  private get windows(): number[] {
    return windowsOf(chartDefaults().settings.window);
  }
  private get window(): number {
    const offered = this.windows;
    const wanted = this.hours ?? chosen;
    return wanted !== undefined && offered.includes(wanted)
      ? wanted
      : chartDefaults().settings.window;
  }

  private get time(): number {
    return this.now ?? Date.now();
  }

  /**
   * What the recorder is asked for the window shown, again once a minute has passed; a late answer for another is
   * dropped.
   */
  private ask(hass: HomeAssistant, id: string): void {
    const view = resolveEntity(hass, id);
    const kind = kindOf(id, view.stateObj);
    const hours = this.window;
    const now = this.time;
    // a frozen clock (a sheet's) is part of what is asked: a read made before it was set is not its window's
    const key = `${id}|${hours}|${kind}|${this.now ?? ''}`;
    const window = { start: now - hours * HOUR, end: now };
    const read = (): Promise<Answer> => {
      if (kind === 'states') return readStates(hass, id, window);
      if (kind === 'measure')
        return readMeasure(hass, id, window, hours, view.attr('state_class') !== undefined);
      // a meter's buckets reach back to its day's midnight (its day so far) and its window's first slot
      const grid = this.grid(hours, now);
      const from = Math.min(
        window.start,
        grid.edges[0] ?? window.start,
        dayStart(hass, new Date(now)),
      );
      return readCounter(
        hass,
        id,
        { start: from, end: now },
        slotOf(hours) === HOUR ? '5minute' : 'hour',
        view.attr('state_class') === INCREASING,
      );
    };
    const previous = this.reads.request(
      key,
      () => read().then((answer) => ({ key, hours, answer })),
      (shown) => (this.shown = shown),
    );
    // another entity: back to the skeleton; another window keeps its picture until the new one comes
    if (previous !== null && !previous.startsWith(`${id}|`)) this.shown = undefined;
  }

  /** A meter's slots over a window: whole hours (whole days over a day), the last one running. */
  private grid(hours: number, now: number): Grid {
    return roundGrid({
      window: { start: now - hours * HOUR, end: now, now },
      step: slotOf(hours),
      hass: this.hass,
      hours: true,
    });
  }

  /* ---------- words ---------- */

  private t(key: DetailsKey, values?: Record<string, string | number>): string {
    return s(this.hass, key, values);
  }

  private clock(t: number): string {
    return formatTime(this.hass, new Date(t));
  }

  private weekday(t: number): string {
    return dateFormat(languageOf(this.hass), { weekday: 'short' }).format(t);
  }

  /** An instant as the window can tell it apart: the clock through two days, its weekday with it beyond. */
  private moment(t: number, hours: number): string {
    return hours > 48 ? `${this.weekday(t)} ${this.clock(t)}` : this.clock(t);
  }

  /* ---------- the block ---------- */

  /** The block's content column: the host less its sides (Home Assistant's 24). */
  private get contentWidth(): number {
    const style = getComputedStyle(this);
    const width =
      this.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0');
    return width > 0 ? Math.floor(width) : FIRST_WIDTH;
  }

  /** A failure of ours gives Home Assistant its own block back for the session, as a takeover that throws does. */
  protected override render(): TemplateResult | typeof nothing {
    try {
      return this.draw();
    } catch (error) {
      stepAside('fluvy-details-history', error);
      const host = this.getRootNode() as ShadowRoot | Document as {
        host?: { requestUpdate?: () => void };
      };
      host.host?.requestUpdate?.();
      return nothing;
    }
  }

  private draw(): TemplateResult | typeof nothing {
    const hass = this.hass;
    const id = this.entityId;
    if (!hass || !id) return nothing;
    // Home Assistant's own block says nothing where the house keeps no history
    const components = hass.config?.['components'];
    if (Array.isArray(components) && !components.includes('history')) return nothing;
    const view = resolveEntity(hass, id);
    const kind = kindOf(id, view.stateObj);
    const width = this.contentWidth;
    const now = this.time;
    const shown = this.shown?.key.startsWith(`${id}|`) ? this.shown : undefined;
    const hours = shown?.hours ?? this.window;
    const drawn =
      shown?.answer.kind === 'states'
        ? this.band(view, shown.answer.rows, hours, width, now)
        : shown?.answer.kind === 'counter'
          ? this.meter(view, shown.answer, hours, width, now)
          : shown?.answer.kind === 'measure'
            ? this.measure(view, shown.answer, hours, width, now)
            : this.waiting(kind, view);
    const windows = this.windows;
    const open = new URLSearchParams({
      entity_id: id,
      start_date: new Date(now - this.window * HOUR).toISOString(),
      back: '1',
    });
    return html`<div class="dh">
      ${this.head(kind, drawn, width)}
      ${this.row(
        windows.map((h) => ({
          key: String(h),
          label: windowWord(hass, h),
          active: h === this.window,
        })),
        (key) => this.pick(Number(key)),
        width,
      )}
      ${
        kind === 'counter'
          ? this.row(
              [
                {
                  key: 'gains',
                  label: this.t(slotOf(this.window) === DAY ? 'per_day' : 'per_hour'),
                  active: this.mode === 'gains',
                },
                { key: 'total', label: this.t('total'), active: this.mode === 'total' },
              ],
              (key) => {
                this.mode = key as Mode;
                this.scrubber.set(null);
              },
              width,
            )
          : nothing
      }
      ${drawn.body} ${drawn.stats}
      <a class="dh-open" href=${`/history?${open.toString()}`}
        ><span>${this.t('open')}</span>${glyph('chevron')}</a
      >
    </div>`;
  }

  /** A full row of chips, in as many columns as hold every word whole (`fittedColumns`): three go two and one. */
  private row(
    items: readonly ChipItem[],
    onSelect: (key: string) => void,
    width: number,
  ): TemplateResult {
    return chips(
      items,
      onSelect,
      '',
      true,
      fittedColumns(items, { ruler: this.headFit.ruler, width }),
    );
  }

  /** A chip taken: the window it names, remembered for the next dialog on this page. */
  private pick(hours: number): void {
    chosen = hours;
    this.hours = hours;
    this.scrubber.set(null);
  }

  /* ---------- the head ---------- */

  /**
   * The head: the history's circle and its name, what the chart reads under it, and what the window says at its end — a
   * readout that stands under the words where the column cannot hold it beside them whole.
   */
  private head(kind: Kind, drawn: Drawn, width: number): TemplateResult {
    const title = this.t('title');
    const lead = drawn.lead;
    const ruler = this.headFit.ruler;
    const beside = lead
      ? Math.max(
          ruler.width('fv-readout__label', lead.label),
          ruler.width(
            'fv-readout fv-readout--s > fv-readout__value',
            lead.value,
            'fv-unit',
            lead.unit,
          ),
        )
      : 0;
    // the head's words whole beside the readout (its circle giving way first), else the readout under them; a line
    // under the title that would not hold even alone goes, never cut
    const fit = (trailing: number): FittedHead =>
      this.headFit.fit({ width, title, sub: drawn.sub, shorter: [''], trailing, icon: 'auto' });
    let fitted = fit(beside);
    const under = beside > 0 && (fitted.cut || fitted.sub !== drawn.sub);
    if (under) fitted = fit(0);
    const shown = lead ? readout({ ...lead, size: 's' }) : nothing;
    return html`${head({
      icon: fitted.icon ? (kind === 'states' ? 'list' : 'chart') : null,
      small: fitted.small,
      title,
      sub: fitted.sub,
      trailing: lead && !under ? html`<div class="dh-lead">${shown}</div>` : nothing,
    })}${under ? html`<div class="dh-lead dh-lead--under">${shown}</div>` : nothing}`;
  }

  /* ---------- what each kind draws ---------- */

  /**
   * A figure of the entity: in its unit, at the precision Home Assistant writes its state with (the one set for it,
   * else the decimals its state carries; three places at most where it reads none).
   */
  private figures(view: EntityView): (value: number) => string {
    const scale: Scale = { unit: view.unit, divisor: 1 };
    const precision =
      precisionOf(this.hass, view) ??
      (view.number === null ? undefined : Math.min(3, view.state.split('.')[1]?.length ?? 0));
    return (value) => figure(this.hass, value, scale, precision);
  }

  /**
   * A readout's figure and its unit ("8.63", "kWh"); a change signed ("+1.4", "−0.6"), one that rounds to nothing never
   * signed; one that is not there a dash alone.
   */
  private said(
    view: EntityView,
    value: number | null,
    signed = false,
  ): { readonly value: string; readonly unit: string } {
    if (value === null) return { value: '—', unit: '' };
    const write = this.figures(view);
    const text = write(value);
    const zero = !/[1-9]/.test(text);
    return {
      value: zero ? write(0) : signed && value > 0 ? `+${text}` : text,
      unit: view.unit,
    };
  }

  /** The skeleton the chart's room holds while the recorder is asked, under a head that keeps its words' places. */
  private waiting(kind: Kind, view: EntityView): Drawn {
    const height = kind === 'states' ? BAND_HEIGHT : CHART_HEIGHT;
    return {
      sub: '',
      lead:
        kind === 'states'
          ? null
          : { label: this.t(kind === 'counter' ? 'today' : 'change'), ...this.said(view, null) },
      body: html`<div class="dh-plot" style="height:${height}px">
          <div class="fv-skeleton"></div>
        </div>
        ${axis([])}`,
      stats: nothing,
    };
  }

  /** A window the recorder had nothing of: the empty panel in the chart's room, the window's clock kept under it. */
  private empty(height: number, ticks: readonly (readonly [number, string])[]): TemplateResult {
    return html`<div class="dh-plot" style="height:${height}px">
        ${emptyState('chart', localize(this.hass, 'sensor.no_history'))}
      </div>
      ${axis(ticks)}`;
  }

  /** The clock of a window that ends now (its quarters, "Now" last), as many labels as stand 12 apart in `width`. */
  private rolling(
    hours: number,
    now: number,
    width: number,
  ): readonly (readonly [number, string])[] {
    return quarterTicks({
      hours,
      now,
      time: (t) => this.clock(t),
      daysAgo: (days) => localize(this.hass, 'sensor.days_ago', { count: Number(days.toFixed(1)) }),
      nowWord: this.t('now'),
      holds: (items) => axisHolds(this.headFit.ruler, width, items),
    });
  }

  /**
   * What every chart of the block shares: the house's style for what it can draw, the scale's words and their ruler.
   */
  private base(
    caps: Parameters<typeof resolveStyle>[2],
  ): Pick<ChartSpec, 'style' | 'tick' | 'measure'> {
    return {
      style: resolveStyle(undefined, {}, caps),
      tick: (value, decimals) => tickText(this.hass, value, decimals),
      measure: (text) => this.headFit.ruler.width('fc-tick', text),
    };
  }

  /** Where the chart is read, as a fraction of its plot (the scrub's is of the drawing, a scale's column before it). */
  private cursor(spec: ChartSpec): number | null {
    const at = this.scrubber.value;
    if (at === null) return null;
    const left = plotOf(spec).left;
    const width = spec.frame.width;
    return Math.min(1, Math.max(0, (at * width - left) / Math.max(1, width - left)));
  }

  /** The plot, a surface read by hand: by pointing, or from the keyboard (← →, Shift five, Home End, Escape). */
  private plot(height: number, drawing: TemplateResult): TemplateResult {
    return html`<div
      class="dh-plot"
      style="height:${height}px"
      tabindex="0"
      aria-label=${this.t('read')}
      @keydown=${(event: KeyboardEvent) => this.scrubber.key(event)}
      ${scrub(this.scrubber)}
    >
      ${drawing}
    </div>`;
  }

  /** A chart drawn with what it reads at the cursor, its clock under the plot from where the plot starts. */
  private chart(
    spec: ChartSpec,
    read: Reading | null,
    ticks: (width: number) => readonly (readonly [number, string])[],
    cuts: readonly number[] = [],
  ): TemplateResult {
    const left = plotOf(spec).left;
    const family = getComputedStyle(this).fontFamily;
    const plot = spec.frame.width - left;
    // where a meter was reset, a dotted hairline across the plot says why its line breaks there
    const marks = cuts.map(
      (cut) =>
        html`<i
          class="dh-reset"
          data-measure="drawn"
          style="left:${(left + cut * plot).toFixed(2)}px"
        ></i>`,
    );
    return html`${this.plot(spec.frame.height, html`${marks}${drawRead(spec, read, null, family)}`)}
      <div style=${left > 0 ? `margin-inline-start:${left}px` : nothing}>
        ${axis(ticks(plot))}
      </div>`;
  }

  /** Three readouts in as many equal columns as hold them (`statsRow`), at the size they fit. */
  private stats(
    width: number,
    items: readonly { label: string; value: string; unit: string }[],
  ): TemplateResult {
    const row = statsRow(this.headFit.ruler, width, items);
    return html`<div
      class="dh-cols fv-cols ${row.odd ? 'fv-cols--odd' : ''}"
      style="grid-template-columns:repeat(${row.columns}, minmax(0, 1fr))"
    >
      ${items.map((item) => readout({ ...item, size: row.size }))}
    </div>`;
  }

  /**
   * A measure: its line through the window on the house's round times (`timeLine`), ending on its reading now; in a
   * style of bars where its readings add up (a power), the mean of each slot. Its head says how much it moved, the row
   * under it its lowest, highest and mean.
   */
  private measure(
    view: EntityView,
    answer: Extract<Answer, { kind: 'measure' }>,
    hours: number,
    width: number,
    now: number,
  ): Drawn {
    const start = now - hours * HOUR;
    const live = view.number;
    const readings = live === null ? answer.readings : [...answer.readings, { t: now, v: live }];
    const reach = reachOf(readings, start, now);
    const write = this.figures(view);
    const unit = view.unit;
    const finest = answer.source === 'states' ? 0 : PERIOD[answer.source];
    const lead = {
      label: this.t('change'),
      ...this.said(view, reach ? reach.last - reach.first : null, true),
    };
    const stats = this.stats(
      width,
      (
        [
          ['min', reach?.min ?? null],
          ['max', reach?.max ?? null],
          ['average', reach?.average ?? null],
        ] as const
      ).map(([key, value]) => ({ label: this.t(key), ...this.said(view, value) })),
    );
    const sub = this.t(answer.source === 'states' ? 'sub_states' : `sub_${answer.source}`);
    const ticks = (plot: number): readonly (readonly [number, string])[] =>
      this.rolling(hours, now, plot);
    if (!reach || answer.readings.length === 0)
      return { sub, lead, body: this.empty(CHART_HEIGHT, ticks(width)), stats };
    const added = readingsOf(view.deviceClass, view.attr('state_class'), unit);
    const base = this.base({ axis: true, bars: added.bars, time: true, finest });
    const frame = { width, height: CHART_HEIGHT, headroom: HEADROOM };
    if (isBars(base.style.preset)) {
      const grid = this.grid(hours, now);
      const values = readSlots(answer.readings, grid.edges, {
        hold: finest || Infinity,
        until: now,
      });
      const spec: ChartSpec = {
        ...base,
        frame,
        series: [{ values, soFar: grid.running }],
        kind: 'bars',
        zero: added.zero,
        id: 'dh',
      };
      const cursor = this.cursor(spec);
      const index = cursor === null ? null : readAt(spec, cursor).index;
      const value = index === null ? null : (values[index] ?? null);
      return {
        sub,
        lead,
        body: this.chart(
          { ...spec, cursor },
          index === null || value === null
            ? null
            : { value: write(value), unit, time: this.slotTime(grid, index, hours) },
          (plot) => this.slotAxis(grid, hours, plot),
        ),
        stats,
      };
    }
    const line = timeLine({
      readings: answer.readings,
      start,
      end: now,
      width,
      style: base.style,
      hass: this.hass,
      finest,
    });
    if (live !== null) line.values[line.values.length - 1] = live;
    const spec: ChartSpec = {
      ...base,
      style: line.style,
      frame,
      series: [line],
      zero: added.zero,
      id: 'dh',
    };
    return { sub, lead, body: this.readLine(spec, line, view, hours, ticks), stats };
  }

  /** A line read by hand: the reading at the time the line snaps to, the bubble saying when. */
  private readLine(
    spec: ChartSpec,
    line: {
      read(
        fraction: number,
      ): { readonly t: number; readonly v: number; readonly fraction: number } | null;
    },
    view: EntityView,
    hours: number,
    ticks: (width: number) => readonly (readonly [number, string])[],
    cuts: readonly number[] = [],
  ): TemplateResult {
    const fraction = this.cursor(spec);
    const timed = fraction === null ? null : line.read(fraction);
    return this.chart(
      { ...spec, cursor: timed?.fraction ?? fraction },
      timed
        ? { value: this.figures(view)(timed.v), unit: view.unit, time: this.moment(timed.t, hours) }
        : null,
      ticks,
      cuts,
    );
  }

  /**
   * When a slot began, as its bar says it: its hour, or its day (the weekday) over longer windows; the running one so
   * far.
   */
  private slotTime(grid: Grid, index: number, hours: number): string {
    const from = grid.edges[index] as number;
    const when = slotOf(hours) === DAY ? this.weekday(from) : this.clock(from);
    return grid.running && index === grid.edges.length - 2 ? `${when} · ${this.t('so_far')}` : when;
  }

  /** The clock under a meter's bars: on the slots' own edges (`slotTicks`), or each day's name under its bar. */
  private slotAxis(
    grid: Grid,
    hours: number,
    width: number,
  ): readonly (readonly [number, string])[] {
    const holds = (items: readonly (readonly [number, string])[]): boolean =>
      axisHolds(this.headFit.ruler, width, items);
    if (slotOf(hours) === DAY) {
      const count = grid.edges.length - 1;
      const days = grid.edges
        .slice(0, -1)
        .map((edge, k) => [(k + 0.5) / count, this.weekday(edge)] as const);
      if (holds(days)) return days;
    }
    return slotTicks({
      edges: grid.edges,
      hours,
      running: grid.running,
      time: (t) => this.clock(t),
      daysAgo: (days) => localize(this.hass, 'sensor.days_ago', { count: Number(days.toFixed(1)) }),
      nowWord: this.t('now'),
      holds,
    });
  }

  /**
   * A meter: what it gained in each slot (whole hours, whole days over longer windows; the running one so far, brought
   * up to the reading now), or its running total — a line that breaks where the meter was reset, never one that runs
   * down a cliff. Its head says what it gained today; the row under it what it gained in the window, its best slot and
   * a slot's mean.
   */
  private meter(
    view: EntityView,
    answer: Extract<Answer, { kind: 'counter' }>,
    hours: number,
    width: number,
    now: number,
  ): Drawn {
    const start = now - hours * HOUR;
    const increase = view.attr('state_class') === INCREASING;
    const buckets = answer.buckets;
    const since = gainSince(lastState(buckets), view.number, increase);
    const grid = this.grid(hours, now);
    const gains = gainsIn(buckets, grid.edges, grid.running, since);
    const write = this.figures(view);
    const unit = view.unit;
    const daily = slotOf(hours) === DAY;
    const today = gainedSince(buckets, dayStart(this.hass, new Date(now)), since);
    const lead = { label: this.t('today'), ...this.said(view, today, true) };
    const known = gains.filter((gain): gain is number => gain !== null);
    const whole = known.slice(0, grid.running && gains[gains.length - 1] !== null ? -1 : undefined);
    const stats = this.stats(width, [
      {
        label: this.t('gained'),
        ...this.said(view, known.length ? known.reduce((a, b) => a + b, 0) : null),
      },
      {
        label: this.t(daily ? 'best_day' : 'best_hour'),
        ...this.said(view, known.length ? Math.max(...known) : null),
      },
      {
        label: this.t('average'),
        ...this.said(view, whole.length ? whole.reduce((a, b) => a + b, 0) / whole.length : null),
      },
    ]);
    const frame = { width, height: CHART_HEIGHT, headroom: HEADROOM };
    if (this.mode === 'gains') {
      const sub = this.t(daily ? 'sub_daily' : 'sub_hourly');
      if (!known.length)
        return {
          sub,
          lead,
          body: this.empty(CHART_HEIGHT, this.slotAxis(grid, hours, width)),
          stats,
        };
      const spec: ChartSpec = {
        ...this.base({ axis: true, bars: true }),
        frame,
        series: [{ values: gains, soFar: grid.running }],
        kind: 'bars',
        zero: true,
        value: (value) => write(value),
        id: 'dh',
      };
      const cursor = this.cursor(spec);
      const index = cursor === null ? null : readAt(spec, cursor).index;
      const value = index === null ? null : (gains[index] ?? null);
      return {
        sub,
        lead,
        body: this.chart(
          { ...spec, cursor },
          index === null || value === null
            ? null
            : { value: write(value), unit, time: this.slotTime(grid, index, hours) },
          (plot) => this.slotAxis(grid, hours, plot),
        ),
        stats,
      };
    }
    // the running total: each bucket's state, broken at every reset (and at one since the last bucket, the reading now
    // under the state it left)
    const readings = totalsOf(buckets);
    const ticks = (plot: number): readonly (readonly [number, string])[] =>
      this.rolling(hours, now, plot);
    const sub = this.t('sub_total');
    if (!readings.some((reading) => reading.t >= start))
      return { sub, lead, body: this.empty(CHART_HEIGHT, ticks(width)), stats };
    const counted = buckets.flatMap((bucket) =>
      bucket.state === null ? [] : [{ t: bucket.t, v: bucket.state, change: bucket.change }],
    );
    const live = view.number;
    const last = lastState(buckets);
    const finest = answer.source === 'states' ? 0 : PERIOD[answer.source];
    const resets = [
      ...resetsOf(counted, increase),
      ...(increase && live !== null && last !== null && live < last
        ? [Math.min(now, (counted[counted.length - 1]?.t ?? now) + finest)]
        : []),
    ];
    const base = this.base({ axis: true, time: true, finest });
    const laid = timeLine({
      readings,
      start,
      end: now,
      width,
      style: base.style,
      hass: this.hass,
      finest,
    });
    if (live !== null) laid.values[laid.values.length - 1] = live;
    const cuts = resets
      .filter((t) => t > start && t <= now)
      .map((t) => (t - start) / (now - start));
    const broken: Laid = breakAt(laid, cuts, base.style.every === 'auto');
    const spec: ChartSpec = {
      ...base,
      style: laid.style,
      frame,
      series: [{ values: broken.values, at: broken.at }],
      id: 'dh',
    };
    return { sub, lead, body: this.readLine(spec, laid, view, hours, ticks, cuts), stats };
  }

  /**
   * A thing's states: the stretches it spent in each on one track, painted by the engine's rule (on the accent, doing
   * something quieter the neutral, nothing known striped, resting the track's own fill), read by hand — the bubble says
   * the state under the cursor and its stretch. Its head says how long it was on (open, playing …), or how often it
   * changed.
   */
  private band(
    view: EntityView,
    rows: readonly Recorded[],
    hours: number,
    width: number,
    now: number,
  ): Drawn {
    const start = now - hours * HOUR;
    const changed = view.stateObj?.last_changed ? Date.parse(view.stateObj.last_changed) : NaN;
    const stretches = stretchesOf(
      rows,
      start,
      now,
      view.stateObj && Number.isFinite(changed)
        ? { state: view.stateObj.state, since: changed }
        : undefined,
    );
    const word = (state: string): string =>
      stateText(this.hass, {
        ...view,
        state,
        status: state === 'unavailable' || state === 'unknown' ? state : 'ok',
        stateObj: view.stateObj ? { ...view.stateObj, state } : undefined,
      } as EntityView);
    const on = timeOn(view.domain, stretches);
    const changes = Math.max(0, stretches.length - 1);
    const sub = on
      ? this.t('on_for', { state: word(on.state), time: spanText(this.hass, on.ms / 1000) })
      : changes
        ? plural(this.hass, 'details.changes', changes)
        : this.t('no_changes');
    const ticks = this.rolling(hours, now, width);
    if (!stretches.length)
      return { sub, lead: null, body: this.empty(BAND_HEIGHT, ticks), stats: nothing };
    const fraction = this.scrubber.value;
    const at = fraction === null ? null : start + fraction * (now - start);
    const read: Stretch | undefined = at === null ? undefined : stretchAt(stretches, at);
    const share = (t: number): string => (((t - start) / (now - start)) * 100).toFixed(3);
    const x = fraction === null ? 0 : fraction * width;
    // a stretch read: its state, from when to when ("now" while it lasts)
    const until =
      read && read.to < now ? this.moment(read.to, hours) : localize(this.hass, 'page.now');
    const when = read ? `${this.moment(read.from, hours)} → ${until}` : '';
    const body = html`${this.plot(
      BAND_HEIGHT,
      html`<div class="dh-track" data-measure="drawn">
          ${stretches.map((stretch, index) => {
            const tone = stretchTone(view.domain, stretch.state);
            // two stretches of one tone side by side (a select's options, all on) are told apart by a hairline
            const after =
              index > 0 && tone === stretchTone(view.domain, stretches[index - 1]!.state);
            return html`<i
              class="fv-stretch ${tone} ${after ? 'is-after' : ''}"
              style="left:${share(stretch.from)}%;right:${share(now + start - stretch.to)}%"
            ></i>`;
          })}
        </div>
        ${
          read
            ? html`<i class="dh-cursor" data-measure="drawn" style="left:${x.toFixed(2)}px"></i
                >${chartBubble({
                  x,
                  width,
                  value: word(read.state),
                  time: when,
                  family: getComputedStyle(this).fontFamily,
                  lean: 0,
                  look: resolveStyle(undefined, {}, {}).bubble,
                })}`
            : nothing
        }`,
    )}
    ${axis(ticks)}`;
    return { sub, lead: null, body, stats: nothing };
  }
}

/** What a kind draws: the head's words, what the window says at its end, the chart with its clock, the row under it. */
interface Drawn {
  readonly sub: string;
  readonly lead: { readonly label: string; readonly value: string; readonly unit: string } | null;
  readonly body: TemplateResult;
  readonly stats: TemplateResult | typeof nothing;
}

if (!customElements.get('fluvy-details-history'))
  customElements.define('fluvy-details-history', FluvyDetailsHistory);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-details-history': FluvyDetailsHistory;
  }
}
