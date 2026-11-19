// the card's words first: they are here before it speaks
import './english.js';
import {
  entriesOf,
  formatNumber,
  isUsable,
  numberAttr,
  strings as words,
  textAttr,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';
import {
  dialDiscRadius,
  head,
  ico,
  pressCover,
  readout,
  sheetStyles,
  textWidth,
  type Tone,
} from '@fluvy/ui';
import { css, html, nothing, svg, type CSSResultGroup, type TemplateResult } from 'lit';

import { HeadFit } from '../energy/head.js';
import { gaugeLabel, widestFigure, widestOf, windowRow } from '../gauge/gauge-card.js';
import { Card, type CardEditor } from '../shared/base.js';
import { toneOf } from '../shared/colour.js';
import { classWord, iconOf, stateWord } from '../shared/domain.js';
import { withUnit } from '../shared/duration.js';
import { statsSize } from '../shared/readouts.js';
import { bandTint, type TintConfig } from '../shared/state-tint.js';
import type { Band, ThresholdsConfig } from '../shared/thresholds.js';
import { askedParts, decimalsOf, type NumberKeys } from '../shared/units.js';
import { COMPASS, type CompassKey } from '../shared/weather.js';
import { compassHeight } from '../weather-family.js';

const s = words('compass');
const weatherWords = words('weather');

/**
 * How a bearing is marked on the ring, each one of Fluvy's controls read: the thermostat's knob riding the ring, the
 * ring's ticks lit across the bearing's sixteenth (the gauge's lit ticks), or the dial's dot outside the ticks (the
 * thermostat's current reading).
 */
export type CompassPointer = 'knob' | 'ticks' | 'dot';
export const COMPASS_POINTERS: readonly CompassPointer[] = ['knob', 'ticks', 'dot'];

/** The card's layouts: the ring in its column, the head over a small ring beside its figure, one row. */
export type CompassVariant = 'full' | 'compact' | 'row';
export const COMPASS_VARIANTS: readonly CompassVariant[] = ['full', 'compact', 'row'];

/** One readout of the row under the ring: a sensor, its name, its unit and decimals. */
export interface CompassStatConfig extends NumberKeys {
  entity: string;
  name?: EntityName;
}

export interface CompassCardConfig
  extends FluvyCardConfig, NumberKeys, ThresholdsConfig, TintConfig {
  /**
   * `full` (default): the ring sized from its column, its figure in it. `compact`: the head and a small ring beside its
   * figure, the readouts at the extra-small size. `row`: one 76 row, its circle ringed by the bearing, its name over
   * its figure and its point.
   */
  variant?: CompassVariant;
  /** The line under the title. */
  subtitle?: string;
  /**
   * The bearing: a state in degrees or in English letters (N, NNE … NNW), the sun's `azimuth`, a weather entity's
   * `wind_bearing`, or any entity's `direction_attribute`. Without it, `entity` is read as one.
   */
  direction_entity?: string;
  /** The attribute the bearing is read from, on any entity (a car's `heading`). */
  direction_attribute?: string;
  /** A second bearing on the same ring, to compare against (a 10-minute average, the sun). */
  secondary_direction_entity?: string;
  secondary_direction_attribute?: string;
  /** How the bearing is marked (`knob`); the second's (`dot`), in the secondary ink. */
  indicator?: CompassPointer;
  secondary_indicator?: CompassPointer;
  /** Where north is drawn, in degrees clockwise from the top (−180 to 180): a window that does not face north. */
  north_offset?: number;
  /** The word over the figure in the ring. Defaults to what the figure is ("Wind speed", "Direction"). */
  label?: string;
  /** Head badge. Defaults to none, else the words of the band the figure is in. */
  badge?: string;
  /** The ring's ticks (default true). */
  show_ticks?: boolean;
  /** The four cardinal points, in the page's language, in the ring (default true). */
  show_cardinals?: boolean;
  /** The row of readouts under the ring (default true, while `stats` lists one). */
  show_stats?: boolean;
  /** Up to three readouts under the ring (gusts, today's highest, a 10-minute average). */
  stats?: ReadonlyArray<string | CompassStatConfig>;
}

/** The sixteen points of the compass, English's letters: what a direction may say in words. */
const POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

/** The readouts under the ring: three at most. */
const MAX_STATS = 3;

/** A degree wrapped into [0, 360). */
const wrap = (deg: number): number => ((deg % 360) + 360) % 360;

/** How far apart two bearings are, the short way round: 0 to 180°. */
const turn = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

/**
 * A bearing in degrees, [0, 360), from what a direction says: a figure (a state, an attribute) or one of the sixteen
 * points in English's letters, in any case; null for anything else. Only English's: an integration's "O" or "NO" is
 * East or North-East in German and West or North-West in Spanish, French, Italian and Portuguese, so a letter of
 * another language is never guessed at.
 */
export function bearingOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? wrap(value) : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (/^[-+]?\d+(\.\d+)?$/.test(text)) return wrap(Number(text));
  const point = POINTS.indexOf(text.toUpperCase() as (typeof POINTS)[number]);
  return point < 0 ? null : point * 22.5;
}

/**
 * The bearing `view` gives, read where its kind keeps it: an attribute named, else the sun's azimuth, a weather
 * entity's wind bearing, else its state. Null where it cannot be read.
 */
export function directionOf(view: EntityView, attribute?: string): number | null {
  if (!isUsable(view)) return null;
  const kept =
    attribute ||
    (view.domain === 'sun' ? 'azimuth' : view.domain === 'weather' ? 'wind_bearing' : '');
  return bearingOf(kept ? view.attr(kept) : view.state);
}

/** The point of the sixteen a bearing is nearest: 0 for North, 1 for North-North-East … 15. */
export const pointOf = (bearing: number): number => Math.round(wrap(bearing) / 22.5) % 16;

/**
 * A point of the sixteen in the page's language: a cardinal or an intercardinal in the weather's words, a point
 * between them as its language joins the two ("N" and "NE" are "NNE"; Japanese's 北 and 北東 are 北北東; Polish joins
 * them with a hyphen).
 */
export function pointWord(hass: HomeAssistant | undefined, point: number): string {
  const word = (index: number): string =>
    weatherWords(hass, COMPASS[(index % 16) / 2] as CompassKey);
  if (point % 2 === 0) return word(point);
  // the cardinal of a point between two is its neighbour on a multiple of four
  const [cardinal, intercardinal] =
    (point + 1) % 4 === 0 ? [point + 1, point - 1] : [point - 1, point + 1];
  return s(hass, 'point16', { cardinal: word(cardinal), intercardinal: word(intercardinal) });
}

/** A bearing in whole degrees, as the card writes it: 359.6 is 0, never 360. */
export const degreesOf = (bearing: number): number => Math.round(wrap(bearing)) % 360;

/** A bearing in words: its whole degrees, the sign attached ("248°"). */
export const degreesText = (hass: HomeAssistant | undefined, bearing: number): string =>
  `${formatNumber(hass, degreesOf(bearing), { digits: 0 })}°`;

/** The ring's ticks: as long as the gauge's, a long one every 45°; the ring as large as the gauge's. */
const TICK = 12;
const RADIUS = 96;

/** Under this radius the reading is written under the ring: its open centre would not hold it (half a section). */
const INSIDE = 56;

/** The compact card's small ring, beside its figure: R 28 and its ticks in a 104 box. */
const COMPACT_RADIUS = 28;

/** Where north is drawn, in degrees clockwise from the top: the config's, held to −180…180. */
const offsetOf = (config: CompassCardConfig): number =>
  typeof config.north_offset === 'number' ? Math.max(-180, Math.min(180, config.north_offset)) : 0;

/** The four cardinal points, by their bearings, in the weather's words. */
const CARDINALS: readonly (readonly [bearing: number, word: CompassKey])[] = [
  [0, 'dir.n'],
  [90, 'dir.e'],
  [180, 'dir.s'],
  [270, 'dir.w'],
];

/** The cardinal points' face (`.cp-point`), as a dial's label: 11/600, tracked. */
const POINT_FACE = { size: 11, weight: 600, tracking: 0.06 } as const;

/** One of the ring's ticks: its bearing on the drawn ring (north at the top, `north_offset` turned) and its ends. */
interface Tick {
  readonly bearing: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** What the ring's open centre reads: its figure, its words, and the reading a threshold is held to. */
interface Reading {
  readonly value: string;
  readonly unit: string;
  readonly word: string;
  /** The figure is the bearing itself: the line under it says its point alone. */
  readonly bearing: boolean;
  readonly band: Band | undefined;
}

/**
 * A bearing on a 360° ring, drawn as Fluvy's dials are: the gauge's ticks all the way round, the four cardinal points
 * in the page's language in place of their ticks, the bearing marked by the thermostat's knob (or the ticks lit
 * across it, or the dial's dot), a second bearing to compare against in the secondary ink, the reading in the open
 * centre — a sensor's (wind speed), a weather entity's wind, or the bearing itself — over the point and the degrees,
 * and up to three readouts under the ring. Wind, a car's heading, a dish's or the sun's azimuth: a direction with a
 * figure or without one. Compass card by @twodrops (#209).
 */
export class FluvyCompassCard extends Card<CompassCardConfig> {
  static override layoutHeight(config: LovelaceCardConfig): number {
    return compassHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.solar,
    css`
      /* the ring is placed on a whole pixel (its ticks stay crisp in an odd column), as the gauge's */
      .so-gauge {
        justify-content: flex-start;
      }
      .cp-dial {
        flex: 0 0 auto;
      }
      .cp-dial > svg {
        position: absolute;
        left: 0;
        top: 0;
        overflow: visible;
      }
      .cp-ring {
        fill: none;
        stroke: var(--fluvy-border-strong);
        stroke-width: 2;
      }
      /* the cardinal points stand in their ticks' place, upright whatever way the ring is turned */
      .cp-point {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-anchor: middle;
        dominant-baseline: central;
        fill: var(--fluvy-text-secondary);
      }
      .cp-point.is-north {
        fill: var(--fluvy-text);
      }
      .cp-dial.is-off .cp-point {
        fill: var(--fluvy-text-disabled);
      }
      /* the second bearing's dot, in the secondary ink, as the thermostat's current reading; the bearing's own in the
         card's */
      .cp-dot {
        fill: var(--tone-ink);
      }
      /* a label longer than the ring's open centre is a name: it ends in an ellipsis inside it (the gauge's rule) */
      .cp-dial .fv-dial__label-in,
      .cp-under .fv-readout__label {
        max-width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .cp-dial .fv-dial__value,
      .cp-dial .fv-dial__sub {
        white-space: nowrap;
      }
      /* a figure past a threshold says itself in its band's colour (1.22, #204), its unit as it is */
      .cp-dial .fv-dial__value[data-ink] > :first-child {
        color: var(--fv-ink);
      }
      /* the point in the text's ink, the degrees beside it in the line's */
      .cp-point-word {
        font-weight: 600;
        color: var(--fluvy-text);
      }
      /* the reading under a ring too small to hold it: the readout, the point and the degrees under it, centred */
      .cp-under {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 12px;
        text-align: center;
      }
      .cp-under .fv-readout__value {
        justify-content: center;
      }
      /* the compact card: its small ring at the start, its figure beside it, the point and the degrees under that */
      .so-gauge.cp-beside {
        align-items: center;
        gap: 16px;
      }
      .cp-reading {
        flex: 1 1 auto;
        min-width: 0;
      }
      .cp-reading .fv-readout__label {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .cp-reading .fv-dial__sub {
        white-space: nowrap;
      }
      .so-cols .fv-readout__label {
        white-space: nowrap;
      }
      /* the row: the house's (76, 16 in), the card's circle ringed by the compass 3 clear of it; the row is the card's
         button (a cover over it, the head's rule) */
      .cp-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        height: 76px;
        padding: 16px;
      }
      /* held by another card's surface (the Expander's), the row stands out by its own padding */
      :host:has(> .cp-row) {
        --fv-pad: 16px;
      }
      .cp-row .fv-row__text {
        flex: 1 1 auto;
        min-width: 0;
      }
      .cp-row > .fv-tile__tap {
        border-radius: inherit;
      }
      .cp-ringed {
        position: relative;
        display: grid;
        place-items: center;
        flex: 0 0 44px;
        width: 44px;
        height: 44px;
      }
      /* a circle with actions of its own (#179) is a button raised over the row's cover */
      .cp-ringed:has(> .fv-ico--tap) {
        z-index: 1;
      }
      .cp-ringed > svg {
        position: absolute;
        top: -7px;
        left: -7px;
        width: 58px;
        height: 58px;
        overflow: visible;
      }
      .cp-track {
        fill: none;
        stroke: var(--fluvy-border);
        stroke-width: 2;
      }
      .cp-notch {
        stroke: var(--fluvy-text);
        stroke-width: 2;
        stroke-linecap: round;
      }
      .cp-arc {
        fill: none;
        stroke: var(--tone-ink);
        stroke-width: 3;
        stroke-linecap: round;
      }
      /* the knob in small: the card's disc, the tone's ring */
      .cp-mini-knob {
        fill: var(--fv-solid-card, var(--fluvy-card));
        stroke: var(--tone-ink);
        stroke-width: 2;
      }
      /* the second bearing in the secondary ink, as the thermostat's current reading */
      .cp-ringed .is-second {
        --tone-ink: var(--fluvy-text-secondary);
      }
    `,
  ];

  private readonly head = new HeadFit(this);

  /** The ring's ticks, laid out once a ring (its radius, its step, its turn, its gaps for the points). */
  private ticks: { readonly key: string; readonly all: readonly Tick[] } | undefined;

  static override editor(): Promise<CardEditor> {
    return import('./compass-editor.js');
  }

  /**
   * A wind sensor and its bearing where the house has them (Home Assistant's wind speed and wind direction classes,
   * else a bearing's or a heading's name), else a weather entity's wind, else the sun: never the speed read as a
   * direction.
   */
  static getStubConfig(
    hass: { states?: Record<string, { attributes: { device_class?: string } }> } | undefined,
    entities: readonly string[],
  ): CompassCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const of = (cls: string): string | undefined =>
      sensors.find((id) => hass?.states?.[id]?.attributes.device_class === cls);
    const direction =
      of('wind_direction') ??
      sensors.find((id) => /wind.*(dir|bearing)|bearing|heading|azimuth/i.test(id)) ??
      entities.find((id) => id.startsWith('weather.')) ??
      'sun.sun';
    const speed = direction.startsWith('weather.') ? undefined : of('wind_speed');
    return {
      type: 'custom:fluvy-compass-card',
      ...(speed ? { entity: speed } : {}),
      direction_entity: direction,
    };
  }

  protected override prepare(config: CompassCardConfig): CompassCardConfig {
    if (!config.entity && !config.direction_entity)
      throw new Error('fluvy-compass-card: "entity" or "direction_entity" is required');
    return config;
  }

  override getCardSize(): number {
    return Math.ceil(FluvyCompassCard.layoutHeight(this.config ?? { type: '' }) / 50);
  }

  /**
   * The ring and the compact card take a section, half a section their floor (the reading then written under the
   * ring); the row half a section, as the house's rows.
   */
  override getGridOptions(): LovelaceGridOptions {
    return { columns: this.variant === 'row' ? 6 : 12, rows: 'auto', min_columns: 6 };
  }

  private get variant(): CompassVariant {
    const asked = this.config?.variant;
    return asked === 'compact' || asked === 'row' ? asked : 'full';
  }

  protected override watched(): readonly string[] {
    const c = this.config;
    return [
      c?.entity ?? '',
      c?.direction_entity ?? '',
      c?.secondary_direction_entity ?? '',
      ...this.statItems().map((item) => item.entity),
    ].filter(Boolean);
  }

  /** The readouts under the ring, three at most; none where `show_stats` is false. */
  private statItems(): readonly CompassStatConfig[] {
    if (this.config?.show_stats === false) return [];
    return entriesOf<CompassStatConfig>(this.config?.stats)
      .slice(0, MAX_STATS)
      .map((item) => (typeof item === 'string' ? { entity: item } : item));
  }

  /** The entity the bearing is read from: its own, else the card's. */
  private get directionId(): string {
    return this.config?.direction_entity || this.config?.entity || '';
  }

  /**
   * What the open centre reads: the card's sensor (`entity`) beside a bearing of its own; else a weather entity's wind
   * as its speed and its unit say it; else the bearing itself, in degrees. The figure's word is the person's `label`
   * (applied by the caller), else what the figure is: its class's word ("Wind speed"), else "Direction".
   */
  private reading(direction: EntityView, bearing: number | null): Reading {
    const c = this.config!;
    // a sensor alone is the bearing: the figure is its own only beside a bearing named of its own
    if (c.entity && c.direction_entity) {
      const view = this.entity(c.entity);
      const usable = isUsable(view);
      const parts = askedParts(this.hass, view, c);
      return {
        value: usable ? parts.value : '—',
        unit: usable ? parts.unit : '',
        word: classWord(this.hass, view.deviceClass),
        bearing: false,
        band: usable ? this.band(c, view) : undefined,
      };
    }
    const speed = direction.domain === 'weather' ? numberAttr(direction, 'wind_speed') : null;
    if (speed !== null && isUsable(direction)) {
      const unit = textAttr(direction, 'wind_speed_unit');
      const parts = askedParts(this.hass, { ...direction, number: speed, unit }, c, speed);
      return {
        ...parts,
        word: classWord(this.hass, 'wind_speed'),
        bearing: false,
        band: this.thresholds(c, unit, direction.id)?.band(speed),
      };
    }
    // the degrees attached to their figure, as a temperature's are
    return {
      value: bearing === null ? '—' : degreesText(this.hass, bearing),
      unit: '',
      word: direction.deviceClass
        ? classWord(this.hass, direction.deviceClass)
        : s(this.hass, 'direction'),
      bearing: true,
      band: undefined,
    };
  }

  /** The ring's ticks for a ring of radius `r` centred at `c`, laid out once (`ticks`). */
  private ticksOf(
    r: number,
    c: number,
    step: number,
    offset: number,
    gaps: readonly (readonly [bearing: number, half: number])[],
  ): readonly Tick[] {
    const key = `${r}|${c}|${step}|${offset}|${gaps.map(([, half]) => half.toFixed(1))}`;
    if (this.ticks?.key === key) return this.ticks.all;
    const all: Tick[] = [];
    for (let bearing = 0; bearing < 360; bearing += step) {
      // a cardinal point stands where its ticks would
      if (gaps.some(([at, half]) => turn(bearing, at) <= half)) continue;
      const a = ((bearing + offset) * Math.PI) / 180;
      const [sin, cos] = [Math.sin(a), Math.cos(a)];
      const out = r + (bearing % 45 === 0 ? TICK : TICK * 0.6);
      all.push({
        bearing,
        x1: c + r * sin,
        y1: c - r * cos,
        x2: c + out * sin,
        y2: c - out * cos,
      });
    }
    this.ticks = { key, all };
    return all;
  }

  protected renderCard(): TemplateResult {
    const c = this.config!;
    const width = this.contentWidth;
    const direction = this.entity(this.directionId);
    const main = c.entity ? this.entity(c.entity) : direction;
    const bearing = directionOf(direction, c.direction_attribute);
    const second = c.secondary_direction_entity
      ? directionOf(this.entity(c.secondary_direction_entity), c.secondary_direction_attribute)
      : null;
    const reading = this.reading(direction, bearing);
    const band = reading.band;
    // out of reach, all of it: the figure and the bearing alike
    const unusable = !isUsable(main) && !isUsable(direction);
    const tone: Tone = band?.tone ?? toneOf(c, 'accent');
    const headTone: Tone = unusable ? 'off' : tone;
    const tinted = bandTint(this.accents, c, band);

    const point = bearing === null ? null : pointOf(bearing);
    const pointWords = point === null ? '—' : pointWord(this.hass, point);
    const degrees = bearing === null ? '' : degreesText(this.hass, bearing);
    if (this.variant === 'row')
      return this.renderRow({
        main,
        bearing,
        second,
        reading,
        unusable,
        tone,
        pointWords,
        degrees,
      });

    // the ring from the column, as the gauge's: R 96 in a 240 box from a 240 column, down to half a section's; the
    // compact card's small one beside its figure
    const compact = this.variant === 'compact';
    const r = compact
      ? COMPACT_RADIUS
      : Math.min(RADIUS, Math.max(32, Math.floor((width / 2 - TICK - 12) / 4) * 4));
    // the box's half: the ring, its ticks and the knob's 12 past them, on the 4 grid as the radius is
    const half = r + TICK + 12;
    const inset = Math.max(0, Math.floor(width / 2 - half));
    const large = r >= 72;
    // the figure in the ring's open centre (the full card's, from R 56), beside the compact card's small ring where
    // the column holds it at the small readout's size, else under the ring
    const besideRoom = width - 2 * half - 16;
    const where: 'inside' | 'beside' | 'under' = compact
      ? this.figureWidth(reading, 's') <= besideRoom
        ? 'beside'
        : 'under'
      : r >= INSIDE
        ? 'inside'
        : 'under';
    // the word over the figure: the person's (a name: it ends in an ellipsis), else what the figure is, which leaves
    // where its line cannot hold it
    const room =
      where === 'inside' ? 2 * (dialDiscRadius(r) - 8) : where === 'beside' ? besideRoom : width;
    const label = gaugeLabel(c.label, reading.word, room, (text) =>
      this.head.ruler.width(where === 'inside' ? 'fv-dial__label-in' : 'fv-readout__label', text),
    );
    // the readout over the point and the degrees, where the figure is not in the ring: large beside the compact
    // card's ring where it holds there
    const outside = (size: 'l' | 's' | 'xs'): TemplateResult =>
      html`${readout({
        label: label?.text ?? '',
        name: label ? !label.fits : false,
        ...(label ? {} : { glyph: null }),
        value: reading.value,
        unit: reading.unit,
        size,
        ink: band?.ink,
      })}${this.renderPoint(reading, pointWords, degrees)}`;

    const own = this.ownText(c.badge, false)?.text ?? band?.label;
    const badgeText = !this.showBadge ? undefined : unusable ? stateWord(this.hass, main) : own;
    const name = this.nameFor(main, c.name);
    const fitted = this.head.fit({
      width,
      title: name,
      ...this.subtitle(main.areaName),
      badge: badgeText
        ? { text: badgeText, tone: headTone, own: !unusable && own !== undefined }
        : null,
    });

    const stats = this.statItems().map((item) => {
      const view = this.entity(item.entity);
      const asked = { unit: item.unit ?? c.unit, decimals: item.decimals ?? c.decimals };
      const parts = askedParts(this.hass, view, asked);
      const usable = isUsable(view);
      return {
        label: this.nameFor(view, item.name),
        value: usable ? parts.value : '—',
        unit: usable ? parts.unit : '',
        // the widest figure it writes in a house (three figures; its own decimals), in its unit
        widest: {
          value: widestFigure(this.hass, decimalsOf(asked.decimals), 3, false),
          unit: parts.unit || view.unit,
        },
        now: { value: parts.value, unit: parts.unit },
      };
    });
    // laid out by the widest figure the row writes, and by what it writes now where that is wider: never by a dash
    const row = stats.length
      ? windowRow(
          this.head.ruler,
          width,
          stats.map((stat) => stat.label),
          widestOf(
            this.head.ruler,
            stats.flatMap((stat) => (stat.value === '—' ? [stat.widest] : [stat.widest, stat.now])),
          ),
        )
      : null;

    return html`<article
      class="fv-card so-card ${tinted.cls} ${unusable ? 'is-unavailable is-off' : ''}"
      data-card
      data-accent=${band?.accent ?? nothing}
      data-surface=${tinted.surface}
      data-edge=${tinted.edge}
    >
      ${head({
        icon: fitted.icon ? iconOf(main, band?.icon ?? c.icon) : null,
        tone: headTone,
        title: name,
        sub: fitted.sub,
        trailing: fitted.badge,
        cut: fitted.cut,
        ...this.headActions(main.id),
        name: true,
      })}
      <div class="so-gauge ${where === 'beside' ? 'cp-beside' : ''}">
        ${this.renderDial({
          r,
          half,
          inset: where === 'beside' ? 0 : inset,
          large,
          tone: unusable ? 'neutral' : tone,
          bearing,
          second,
          centre:
            where === 'inside'
              ? this.renderCentre(reading, label, large, r, half, pointWords, degrees, band?.ink)
              : nothing,
        })}
        ${
          where === 'beside'
            ? html`<div class="cp-reading">
                ${outside(this.figureWidth(reading, 'l') <= besideRoom ? 'l' : 's')}
              </div>`
            : nothing
        }
      </div>
      ${
        where === 'under'
          ? html`<div class="cp-under">
              ${outside(statsSize(this.head.ruler, width, [{ label: '', ...reading }], 1))}
            </div>`
          : nothing
      }
      ${
        row
          ? html`<div
              class="so-cols fv-cols so-cols--center ${row.odd ? 'fv-cols--odd' : ''}"
              style="grid-template-columns:repeat(${row.columns}, minmax(0, 1fr))"
              data-align="center"
            >
              ${stats.map((stat) => readout({ label: stat.label, value: stat.value, unit: stat.unit, tight: stat.unit === '°', size: compact ? 'xs' : row.size }))}
            </div>`
          : nothing
      }
    </article>`;
  }

  /** A figure's width with its unit at a readout's size. */
  private figureWidth(reading: Reading, size: 'l' | 's'): number {
    return this.head.ruler.width(
      `fv-readout fv-readout--${size} > fv-readout__value`,
      reading.value,
      'fv-unit',
      reading.unit,
    );
  }

  /**
   * One 76 row, the house's (a printer's, a car's mini): the card's circle ringed by the compass 3 clear of it — its
   * track, north's notch, the bearing on it as its pointer marks it (a knob in small, the arc across its sixteenth for
   * lit ticks, a dot) and the second in the secondary ink — its name over its figure, its point and its degrees. In a
   * narrow row the degrees leave the line first, then the point (the ring says it), then a band's words; where the
   * figure would still not hold beside the circle, the circle and its ring give way, the line taking the whole row.
   */
  private renderRow(o: {
    readonly main: EntityView;
    readonly bearing: number | null;
    readonly second: number | null;
    readonly reading: Reading;
    readonly unusable: boolean;
    readonly tone: Tone;
    readonly pointWords: string;
    readonly degrees: string;
  }): TemplateResult {
    const c = this.config!;
    const { reading } = o;
    const band = reading.band;
    const name = this.nameFor(o.main, c.name);
    // the figure, whole, then its point (the ring says it too) and the degrees, which leave first; a band's words lead
    // the line and leave last; the bearing as the figure says its degrees and its point
    const figure = withUnit(reading.value, reading.unit);
    const segments = o.unusable
      ? [{ text: stateWord(this.hass, o.main) }]
      : [
          ...(band?.label ? [{ text: band.label, optional: true }] : []),
          { text: figure },
          ...(reading.bearing && o.bearing === null
            ? []
            : [{ text: o.pointWords, optional: true }]),
          ...(!reading.bearing && o.degrees ? [{ text: o.degrees, optional: true }] : []),
        ];
    // the row's words: its column less its 16 sides (the card's are 20), less the circle's 56 while it is drawn
    const room = this.contentWidth + 8;
    const ringed =
      this.head.ruler.width('fv-row__sub', o.unusable ? segments[0]!.text : figure) <= room - 56;
    const line = this.head.fitRowSegments(segments, room - (ringed ? 56 : 0));
    const tone: Tone = o.unusable ? 'off' : o.tone;
    const tinted = bandTint(this.accents, c, band);
    const actions = this.headActions(o.main.id, `${name} · ${line}`);
    const { onTap, onHold } = actions;
    return html`<article
      class="fv-card so-card cp-row ${tinted.cls} ${o.unusable ? 'is-unavailable is-off' : ''}"
      data-card
      data-accent=${band?.accent ?? nothing}
      data-surface=${tinted.surface}
      data-edge=${tinted.edge}
    >
      ${
        ringed
          ? html`<span class="cp-ringed fv-tone--${tone}">
              ${this.renderRing(o.bearing, o.second)}
              ${ico(iconOf(o.main, band?.icon ?? c.icon), tone, {
                onTap: actions.onIconTap,
                onHold: actions.onIconHold,
                label: actions.iconLabel?.(name),
              })}
            </span>`
          : nothing
      }
      <span class="fv-row__text"
        ><span class="fv-row__title" data-name>${name}</span
        ><span class="fv-row__sub">${line}</span></span
      >
      ${onTap || onHold ? pressCover(`${name} · ${line}`, onTap, onHold) : nothing}
    </article>`;
  }

  /**
   * The ring round a row's circle (R 26.5 in a 58 box, the printer's): its track, north's notch where `north_offset`
   * turns it, and each bearing as its pointer marks it, the second's in the secondary ink under the first.
   */
  private renderRing(bearing: number | null, second: number | null): TemplateResult {
    const c = this.config!;
    const offset = offsetOf(c);
    const R = 26.5;
    const at = (deg: number, radius = R): string => {
      const a = ((deg + offset) * Math.PI) / 180;
      return `${(29 + radius * Math.sin(a)).toFixed(2)} ${(29 - radius * Math.cos(a)).toFixed(2)}`;
    };
    const mark = (deg: number | null, pointer: CompassPointer, cls: string) => {
      if (deg === null) return nothing;
      const [x, y] = at(deg).split(' ');
      if (pointer === 'ticks')
        return svg`<path class="cp-arc ${cls}" d="M ${at(deg - 11.25)} A ${R} ${R} 0 0 1 ${at(deg + 11.25)}" />`;
      return pointer === 'knob'
        ? svg`<circle class="cp-mini-knob ${cls}" cx=${x} cy=${y} r="4.5" />`
        : svg`<circle class="cp-dot ${cls}" cx=${x} cy=${y} r="3" />`;
    };
    return svg`<svg viewBox="0 0 58 58" aria-hidden="true" data-measure="drawn">
      <circle class="cp-track" cx="29" cy="29" r=${R} />
      <path class="cp-notch" d="M ${at(0, R - 3)} L ${at(0, R + 3)}" />
      ${mark(second, c.secondary_indicator ?? 'dot', 'is-second')}
      ${mark(bearing, c.indicator ?? 'knob', '')}
    </svg>`;
  }

  /** The line under the figure: the point, and the degrees where the figure is not already them. */
  private renderPoint(reading: Reading, point: string, degrees: string): TemplateResult {
    return html`<p class="fv-dial__sub">
      <span class="cp-point-word">${point}</span>${
        reading.bearing || !degrees ? nothing : html` · ${degrees}`
      }
    </p>`;
  }

  /**
   * The open centre, as a gauge's dial writes it: the word over the figure, the figure at the largest size its disc
   * holds with its unit (the dial's sizes, measured), the point and the degrees under it.
   */
  private renderCentre(
    reading: Reading,
    label: ReturnType<typeof gaugeLabel>,
    large: boolean,
    r: number,
    half: number,
    point: string,
    degrees: string,
    ink: string | undefined,
  ): TemplateResult {
    const disc = dialDiscRadius(r);
    const unitWidth = reading.unit
      ? 4 + textWidth(reading.unit, { size: large ? 18 : 14, weight: 600 })
      : 0;
    const holds = (size: number): boolean =>
      textWidth(reading.value, { size, weight: 600, tracking: -0.02, tabular: true }) <=
      disc * 2 - 16 - unitWidth;
    const own = large ? 48 : 32;
    const size = holds(own) ? own : ([24, 20, 16].find(holds) ?? 16);
    return html`<div
      class="fv-dial__disc fv-dial__disc--bare"
      style="left:${half - disc}px;top:${half - disc}px;width:${disc * 2}px;height:${disc * 2}px"
    >
      ${
        label
          ? html`<p class="fv-dial__label-in" data-name=${label.fits ? nothing : ''}>
              ${label.text}
            </p>`
          : nothing
      }
      <p
        class="fv-dial__value ${reading.value === '—' ? 'is-off' : ''}"
        data-ink=${ink ?? nothing}
        style=${size === own ? nothing : `font-size:${size}px`}
      >
        <span>${reading.value}</span
        >${reading.unit ? html`<span class="fv-unit">${reading.unit}</span>` : nothing}
      </p>
      ${this.renderPoint(reading, point, degrees)}
    </div>`;
  }

  /**
   * The ring: its ticks (a long one every 45°, the cardinal points in their place, upright, north turned to
   * `north_offset`), the second bearing under the first, each as its pointer marks it, and the centre over it.
   */
  private renderDial(o: {
    readonly r: number;
    readonly half: number;
    readonly inset: number;
    readonly large: boolean;
    readonly tone: Tone;
    readonly bearing: number | null;
    readonly second: number | null;
    readonly centre: TemplateResult | typeof nothing;
  }): TemplateResult {
    const c = this.config!;
    const { r, half } = o;
    const box = half * 2;
    const offset = offsetOf(c);
    const showTicks = c.show_ticks !== false;
    const points =
      c.show_cardinals === false
        ? []
        : CARDINALS.map(([bearing, key]) => ({ bearing, word: weatherWords(this.hass, key) }));
    // a point's word keeps its ticks clear: its box across the ring where it stands, 2 either side
    const gaps = points.map(({ bearing, word }) => {
      const a = ((bearing + offset) * Math.PI) / 180;
      const across =
        (Math.abs(textWidth(word, POINT_FACE) * Math.cos(a)) + Math.abs(11 * Math.sin(a))) / 2 + 2;
      return [bearing, (Math.asin(Math.min(1, across / (r + TICK / 2))) * 180) / Math.PI] as const;
    });
    const ticks = this.ticksOf(r, half, r >= 64 ? 5 : 10, offset, gaps);
    const primary = c.indicator ?? 'knob';
    const secondary = c.secondary_indicator ?? 'dot';
    // the ticks across a bearing's sixteenth: lit by a pointer of ticks
    const across = (bearing: number | null, pointer: CompassPointer) => (tick: Tick) =>
      pointer === 'ticks' && bearing !== null && turn(tick.bearing, bearing) <= 11.25;
    const lit = across(o.bearing, primary);
    const litSecond = across(o.second, secondary);
    const at = (bearing: number, radius: number): readonly [number, number] => {
      const a = ((bearing + offset) * Math.PI) / 180;
      return [half + radius * Math.sin(a), half - radius * Math.cos(a)];
    };
    const line = (tick: Tick, cls: string) =>
      svg`<line x1=${tick.x1.toFixed(2)} y1=${tick.y1.toFixed(2)} x2=${tick.x2.toFixed(2)} y2=${tick.y2.toFixed(2)} class=${cls} />`;
    const dot = (bearing: number | null, pointer: CompassPointer, cls: string) => {
      if (bearing === null || pointer !== 'dot') return nothing;
      const [x, y] = at(bearing, r + TICK + 6);
      return svg`<circle cx=${x.toFixed(2)} cy=${y.toFixed(2)} r="3" class=${cls} />`;
    };
    const knob = (bearing: number | null, pointer: CompassPointer, tone: Tone) => {
      if (bearing === null || pointer !== 'knob') return nothing;
      // the knob its ring can carry: the thermostat's 36, its small dial's 28, a tile's 20
      const size = o.r >= 72 ? 36 : o.r >= 40 ? 28 : 20;
      const [x, y] = at(bearing, r);
      // half pixels: crisp at 2× and 3×, never off the ring
      const place = (v: number): number => Math.round((v - size / 2) * 2) / 2;
      return html`<span
        class="fv-knob fv-knob--${tone}"
        data-measure="value"
        style="translate:${place(x)}px ${place(y)}px;width:${size}px;height:${size}px"
      ></span>`;
    };
    return html`<div
      class="fv-dial fv-dial--${o.large ? 'l' : 's'} fv-dial--gauge fv-dial--${o.tone} cp-dial ${o.tone === 'neutral' && o.bearing === null ? 'is-off' : ''}"
      style="margin-left:${o.inset}px;width:${box}px;height:${box}px"
    >
      <svg width=${box} height=${box} viewBox="0 0 ${box} ${box}" aria-hidden="true">
        ${showTicks ? nothing : svg`<circle class="cp-ring" cx=${half} cy=${half} r=${r} />`}
        ${ticks.map((tick) =>
          lit(tick)
            ? line(tick, 'tk-on')
            : litSecond(tick)
              ? svg`<g class="fv-tone--neutral">${line(tick, 'tk-on')}</g>`
              : showTicks
                ? line(tick, 'tk-off')
                : nothing,
        )}
        ${points.map(({ bearing, word }) => {
          const [x, y] = at(bearing, r + TICK / 2);
          return svg`<text class="cp-point ${bearing === 0 ? 'is-north' : ''}" x=${x.toFixed(2)} y=${y.toFixed(2)}>${word}</text>`;
        })}
        ${dot(o.second, secondary, 'dl-current')}${dot(o.bearing, primary, 'cp-dot')}
      </svg>
      ${o.centre}${knob(o.second, secondary, 'neutral')}${knob(o.bearing, primary, o.tone)}
    </div>`;
  }
}
