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
  type GlyphName,
  type IconRef,
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
import {
  compassBeside,
  compassHeight,
  COMPASS_INSIDE,
  compassRadius,
  COMPASS_RIM,
  COMPASS_SMALL_RING,
} from '../weather-family.js';

const s = words('compass');
const weatherWords = words('weather');

/**
 * How a bearing is marked on the ring: the compass's own arrow across the ring at the bearing, or its chevron in a
 * ringed circle riding the ring (#247); or one of Fluvy's controls read: the thermostat's knob riding the ring, the
 * ring's ticks lit across the bearing's sixteenth (the gauge's lit ticks), or the dial's dot (the thermostat's current
 * reading).
 */
export type CompassPointer = 'arrow' | 'chevron' | 'knob' | 'ticks' | 'dot';
export const COMPASS_POINTERS: readonly CompassPointer[] = [
  'arrow',
  'chevron',
  'knob',
  'ticks',
  'dot',
];

/**
 * The ring's face (#247): a classic compass's, its bezel a band with the ticks across it and the four letters large
 * outside it (the default); or the gauge's ring of ticks with the letters in their place (1.24's).
 */
export type CompassFace = 'classic' | 'ring';
export const COMPASS_FACES: readonly CompassFace[] = ['classic', 'ring'];

/**
 * Which way an arrow or a chevron points: out from the centre to the bearing, as a compass needle's head, or in from
 * the bearing at the figure, as the wind blows from it.
 */
export type CompassArrowPoints = 'outward' | 'inward';
export const COMPASS_ARROW_POINTS: readonly CompassArrowPoints[] = ['outward', 'inward'];

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
  /** The ring's face: `classic` (default), a compass's bezel; `ring`, the gauge's ticks (1.24's). */
  face?: CompassFace;
  /** How the bearing is marked (`arrow`); the second's (`dot`), in the secondary ink. */
  indicator?: CompassPointer;
  secondary_indicator?: CompassPointer;
  /** Which way an arrow or a chevron points, the bearing's and the second's: `outward` (default) or `inward`. */
  arrow_points?: CompassArrowPoints;
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

/** The ring's ticks: as long as the gauge's, a long one every 45°. */
const TICK = 12;

/** The compact card's small ring, beside its figure: R 28 in its 104 box. */
const COMPACT_RADIUS = COMPASS_SMALL_RING / 2 - COMPASS_RIM;

/** Where north is drawn, in degrees clockwise from the top: the config's, held to −180…180. */
const offsetOf = (config: CompassCardConfig): number =>
  typeof config.north_offset === 'number' ? Math.max(-180, Math.min(180, config.north_offset)) : 0;

/** Whether the config's arrows point out from the centre: all but where it asks for them `inward`. */
const pointsOut = (config: CompassCardConfig): boolean => config.arrow_points !== 'inward';

/** The four cardinal points, by their bearings, in the weather's words. */
const CARDINALS: readonly (readonly [bearing: number, word: CompassKey])[] = [
  [0, 'dir.n'],
  [90, 'dir.e'],
  [180, 'dir.s'],
  [270, 'dir.w'],
];

/** The cardinal points' face (`.cp-point`) in their ticks' place, as a dial's label: 11/600, tracked. */
const POINT_FACE = { size: 11, weight: 600, tracking: 0.06 } as const;

/**
 * One of the ring's ticks: its bearing on the drawn ring (north at the top, `north_offset` turned), its ends, and
 * whether it is a cardinal point's bar (a classic face's, bold).
 */
interface Tick {
  readonly bearing: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly bar: boolean;
}

/** A point of the ring's drawing, in its pixels. */
type Point = readonly [x: number, y: number];

/** Where the ring gives way to a cardinal point standing in its place: the point's bearing and the half-angle it takes. */
type Gap = readonly [bearing: number, half: number];

/**
 * A circle of `radius` centred at `c` as the arcs between its gaps (`north_offset` turning them), clockwise: a classic
 * face's band where its letters stand in its place.
 */
const arcsOf = (c: number, radius: number, offset: number, gaps: readonly Gap[]): string => {
  const at = (deg: number): string => {
    const a = ((deg + offset) * Math.PI) / 180;
    return `${(c + radius * Math.sin(a)).toFixed(2)} ${(c - radius * Math.cos(a)).toFixed(2)}`;
  };
  const sorted = [...gaps].sort(([a], [b]) => a - b);
  return sorted
    .map(([bearing, half], i) => {
      const [next, nextHalf] = sorted[(i + 1) % sorted.length]!;
      const [from, to] = [bearing + half, (next <= bearing ? next + 360 : next) - nextHalf];
      return `M${at(from)}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to)}`;
    })
    .join('');
};

/** How a face draws its ticks: its key, each tick's radii by its bearing, and whether a cardinal point's is a bar. */
interface TickFace {
  readonly key: string;
  readonly span: (bearing: number) => readonly [from: number, to: number];
  readonly bars: boolean;
}

/**
 * A classic face's bezel on a ring of radius `r` (#247): a band 12 wide (6 under R 72) in the well's quiet fill, its
 * outer edge 2 past the ring so that the letters outside it keep the ring's box (the card is as tall as with 1.24's
 * ring); the pointers ride its middle, 4 inside the ring on a full one; on a large ring the hairline round the open
 * centre, 5 inside the band (a smaller ring's open centre has no room to spare for one).
 */
export interface Bezel {
  readonly band: number;
  readonly inner: number;
  readonly outer: number;
  readonly track: number;
  readonly line: number | null;
}

export const bezelOf = (r: number): Bezel => {
  const band = r >= 72 ? 12 : 6;
  const outer = r + 2;
  const inner = outer - band;
  return { band, inner, outer, track: outer - band / 2, line: r >= 72 ? inner - 5 : null };
};

/**
 * A tick's ends on a classic face, by its bearing: from the band's outer edge in, the rest short (5 of 12), every
 * 22.5° medium (8), every 45° across the band; a cardinal point's bar across it from the hairline (2 inside the band
 * without one) to 2 past its outer edge, toward its letter.
 */
const classicSpan = (
  { band, inner, outer, line }: Bezel,
  bearing: number,
): readonly [number, number] => {
  if (bearing % 90 === 0) return [line ?? inner - 2, outer + 2];
  const long = bearing % 45 === 0 ? band : bearing % 22.5 === 0 ? (band * 2) / 3 : (band * 5) / 12;
  // the 2 of a tick's round caps inside the band
  return [outer + 1 - long, outer - 1];
};

/**
 * How far from the open centre's middle its ink reaches, by the dial's size: the word over the figure and the line
 * under it (the dial's stack, 92 or 76 tall, 3 in from its ends), and the figure's digits.
 */
const REACH = { l: { line: 43, figure: 18 }, s: { line: 35, figure: 12 } } as const;

/**
 * How wide a line of the open centre may be, `reach` from its middle: the dial's disc less 8 a side, and on a classic
 * face no wider than its open circle (inside its hairline, else its band) holds it there, 3 clear.
 */
const centreRoom = (r: number, bezel: Bezel | undefined, reach: number): number => {
  const disc = 2 * (dialDiscRadius(r) - 8);
  if (!bezel) return disc;
  const clear = (bezel.line ?? bezel.inner) - 3;
  return Math.min(disc, Math.floor(2 * Math.sqrt(Math.max(0, clear * clear - reach * reach))));
};

/**
 * The sizes a classic face's letters (700) may take, largest first, by the ring: from 16 on a full one, 14 and 12 on
 * smaller ones, down to 11.
 */
const letterSizes = (r: number): readonly number[] =>
  [16, 14, 12, 11].filter((size) => size <= (r >= 56 ? 16 : r >= 40 ? 14 : 12));

/** How far a classic face's letters stand from the band: past its bars, 5 from its outer edge. */
const LETTER_CLEAR = 5;

/** A cardinal point as the ring draws it: its word and its box, centred on the ring's centre (x right, y down). */
export interface Letter {
  readonly bearing: number;
  readonly word: string;
  readonly size: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The classic face's four letters (#247), upright wherever `north_offset` turns the ring: each `LETTER_CLEAR` outside
 * the band where its box meets the bearing, at the largest of `sizes` at which all four keep the room their column
 * leaves (`across`, from the ring's centre to the column's nearer edge; `down`, the ring's box: the head is above it).
 * A long word steps them down together ("Wsch" and "Zach" in a half section); where none holds at the smallest, null:
 * the letters then stand in the band's place.
 */
export function classicLetters(
  points: readonly (readonly [bearing: number, word: string])[],
  bezel: Bezel,
  offset: number,
  room: { readonly across: number; readonly down: number },
  sizes: readonly number[],
  widthOf: (word: string, size: number) => number,
): Letter[] | null {
  for (const size of sizes) {
    // a word's box: its width, and its capitals' height (an ideogram's as tall)
    const height = size * 0.75;
    const letters = points.map(([bearing, word]): Letter => {
      const width = widthOf(word, size);
      const a = ((bearing + offset) * Math.PI) / 180;
      const [sin, cos] = [Math.sin(a), Math.cos(a)];
      // the box's half along the bearing: its reach toward the band
      const away =
        bezel.outer + LETTER_CLEAR + (Math.abs(width * sin) + Math.abs(height * cos)) / 2;
      return { bearing, word, size, x: away * sin, y: -away * cos, width, height };
    });
    if (
      letters.every(
        (l) =>
          Math.abs(l.x) + l.width / 2 <= room.across && Math.abs(l.y) + l.height / 2 <= room.down,
      )
    )
      return letters;
  }
  return null;
}

/** The knob a ring carries: the thermostat's 36, its small dial's 28, a tile's 20. */
const knobSize = (r: number): number => (r >= 72 ? 36 : r >= 40 ? 28 : 20);

/** An arrow's measures on its ring: how far it reaches inside it and outside it, its half-width, its notch. */
interface Dart {
  readonly in: number;
  readonly out: number;
  readonly half: number;
  readonly notch: number;
}

/**
 * The arrow in a knob's place, as long as the knob is wide and in the same proportions at every size: for the
 * thermostat's 36, a compass needle's head, isosceles and slim, 35 long and 17 wide, from 12 inside the ring (the open
 * centre's edge) to 23 outside it (past the ticks), gently notched (3) at its base. Pointing out, its tip is the outer
 * end and its base stands at the open centre's edge; pointing in, the other way round.
 */
const dartOf = (size: number): Dart => {
  const k = size / 36;
  return { in: 12 * k, out: 23 * k, half: 8.5 * k, notch: 3 * k };
};

/**
 * A row's arrow across its track in the same proportions, 14 long, from 5 into the circle to no further out than the
 * knob in small reaches: pointing in, its tip in the circle; pointing out, its base.
 */
const ROW_DART: Dart = { in: 9.5, out: 4.5, half: 3.4, notch: 1.2 };

/** The radii an arrow's tip and base stand at on a ring of radius `r`, its tip the outer end where it points out. */
const dartEnds = (
  r: number,
  dart: Dart,
  outward: boolean,
): { readonly tip: number; readonly base: number } =>
  outward ? { tip: r + dart.out, base: r - dart.in } : { tip: r - dart.in, base: r + dart.out };

/**
 * The arrow on a ring of radius `r` centred at `c`, at its top: its tip, a wing, its notch (into its base, toward the
 * tip), the other wing.
 */
const dartPath = (c: number, r: number, dart: Dart, outward: boolean): string => {
  const at = (v: number): number => Math.round(v * 100) / 100;
  const { tip, base } = dartEnds(r, dart, outward);
  const notch = base + Math.sign(tip - base) * dart.notch;
  const [left, right] = [at(c - dart.half), at(c + dart.half)];
  return `M${c} ${at(c - tip)}L${right} ${at(c - base)}L${c} ${at(c - notch)}L${left} ${at(c - base)}Z`;
};

/** The arrow turned to `deg` (clockwise from the top), as the three corners that hold it: its tip and its wings. */
const dartOutline = (c: number, r: number, dart: Dart, deg: number, outward: boolean): Point[] => {
  const a = (deg * Math.PI) / 180;
  const [sin, cos] = [Math.sin(a), Math.cos(a)];
  // along the bearing from the centre, and across it clockwise
  const at = (along: number, across: number): Point => [
    c + along * sin + across * cos,
    c - along * cos + across * sin,
  ];
  const { tip, base } = dartEnds(r, dart, outward);
  return [at(tip, 0), at(base, dart.half), at(base, -dart.half)];
};

/** A round mark (a knob with its halo, a dot) as the twelve corners that hold it. */
const roundOutline = ([x, y]: Point, radius: number): Point[] =>
  Array.from({ length: 12 }, (_, k): Point => {
    const a = (k * Math.PI) / 6;
    return [x + radius * Math.cos(a), y + radius * Math.sin(a)];
  });

/**
 * Whether two convex outlines come within `clear` of each other: no edge of either parts them by more (the separating
 * axis test). A tick is the outline of its two ends.
 */
function meets(a: readonly Point[], b: readonly Point[], clear: number): boolean {
  const normals = (shape: readonly Point[]): Point[] =>
    shape.map(([x, y], i): Point => {
      const [u, v] = shape[(i + 1) % shape.length]!;
      const length = Math.hypot(u - x, v - y) || 1;
      return [(y - v) / length, (u - x) / length];
    });
  return [...normals(a), ...normals(b)].every(([nx, ny]) => {
    const along = (shape: readonly Point[]): number[] => shape.map(([x, y]) => x * nx + y * ny);
    const [sa, sb] = [along(a), along(b)];
    return Math.min(...sa) <= Math.max(...sb) + clear && Math.min(...sb) <= Math.max(...sa) + clear;
  });
}

/** Which pointer a bearing is, the card's own or the second, each remembering where it was last drawn. */
type Slot = 'first' | 'second';

/** A turn about a drawing's centre `c`, what a pointer riding the ring is drawn at. */
const turned = (c: number, angle: number): string =>
  `transform-origin:${c}px ${c}px;rotate:${Math.round(angle * 100) / 100}deg`;

/**
 * An arrow on a ring of radius `r` centred at `c`, turned to `angle` (clockwise from the top, wound as it turned) and
 * pointing out or in: the bearing's filled, the second's its outline alone.
 */
const arrowOf = (
  c: number,
  r: number,
  dart: Dart,
  angle: number,
  second: boolean,
  outward: boolean,
) =>
  svg`<path class="cp-arrow ${second ? 'is-second' : ''}" d=${dartPath(c, r, second ? { ...dart, notch: 0 } : dart, outward)} style=${turned(c, angle)} />`;

/**
 * A chevron's stroke centred at (`c`, `y`) at the top of its ring: `half` either side, its point `depth` from its
 * middle, out from the ring's centre (up) or in at it, its ends as far the other way.
 */
const veeOf = (c: number, y: number, half: number, depth: number, outward: boolean): string => {
  const at = (v: number): number => Math.round(v * 100) / 100;
  const d = outward ? -depth : depth;
  return `M${at(c - half)} ${at(y - d)}L${c} ${at(y + d)}L${at(c + half)} ${at(y - d)}`;
};

/**
 * The chevron in its ringed circle (#247) at the top of a ring of radius `track` centred at `c`, turned to `angle`: the
 * knob's disc and its 2 ring (`size` across), a chevron of the tone's ink in it, 0.4 of the disc wide and 0.22 deep,
 * pointing out from the centre or in at it. Its halo, cutting what it stands on, is a layer of its own under it
 * (`haloOf`), as the knob's lift falls on its halo.
 */
const chevronOf = (
  c: number,
  track: number,
  size: number,
  angle: number,
  second: boolean,
  outward: boolean,
) =>
  svg`<g class="cp-chevron ${second ? 'is-second' : ''}" style=${turned(c, angle)}>
    <circle cx=${c} cy=${c - track} r=${size / 2 + 1} />
    <path class="cp-vee" d=${veeOf(c, c - track, size * 0.2, size * 0.11, outward)} />
  </g>`;

/** A chevron's halo: 6 of the card round its ring, cutting the band and the ticks under it, turned with it. */
const haloOf = (c: number, track: number, size: number, angle: number) =>
  svg`<circle class="cp-halo" cx=${c} cy=${c - track} r=${size / 2 + 8} style=${turned(c, angle)} />`;

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
      /* a classic face's bezel (#247): the band in the well's quiet fill under its ticks, a cardinal point's bar bold
         across it, the hairline round the open centre */
      .cp-band {
        fill: none;
        stroke: var(--fluvy-inset, var(--fluvy-page));
      }
      /* out of reach the card stands on the page's colour: the band keeps its shape a step off it */
      .fv-card.is-off .cp-band {
        stroke: var(--fluvy-page-alt);
      }
      .cp-line {
        fill: none;
        stroke: var(--fluvy-border);
        stroke-width: 1;
      }
      .cp-dial line.is-bar {
        stroke-width: 3;
      }
      /* the cardinal points, upright whatever way the ring is turned, centred where they stand: in their ticks' place
         (11/600, tracked), or large outside a classic face's band (700, at the size their column holds), north in the
         card's ink there */
      .cp-point {
        position: absolute;
        translate: -50% -50%;
        text-align: center;
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.06em;
        white-space: nowrap;
        color: var(--fluvy-text-secondary);
      }
      .cp-point.is-north {
        color: var(--fluvy-text);
      }
      .cp-point.is-large {
        font-weight: 700;
        letter-spacing: 0;
      }
      .cp-dial.is-classic .cp-point.is-north {
        color: var(--tone-ink);
      }
      .cp-dial.is-off .cp-point {
        color: var(--fluvy-text-disabled);
      }
      /* the second bearing's dot, in the secondary ink, as the thermostat's current reading; the bearing's own in the
         card's */
      .cp-dot {
        fill: var(--tone-ink);
      }
      /* the arrow in the tone's ink, its corners rounded; it turns to a new bearing the short way round and settles
         there as a needle does. The second's is its outline alone, in the secondary ink */
      .cp-arrow {
        fill: var(--tone-ink);
        stroke: var(--tone-ink);
        stroke-width: 1.5;
        stroke-linejoin: round;
      }
      .cp-arrow,
      .cp-chevron,
      .cp-halo,
      .cp-vee {
        transition: rotate 640ms var(--fv-spring);
      }
      .cp-arrow.is-second {
        fill: none;
        stroke: var(--fluvy-text-secondary);
      }
      /* the chevron (#247): the knob's disc and ring, a chevron of the tone's ink in it (a row's across its track); it
         turns as the arrow does, its halo with it. The second's in the secondary ink */
      .cp-halo {
        fill: var(--knob-halo);
      }
      .cp-chevron circle {
        fill: var(--fv-solid-card, var(--fluvy-card));
        stroke: var(--tone-ink);
        stroke-width: 2;
      }
      .cp-vee {
        fill: none;
        stroke: var(--tone-ink);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .cp-chevron.is-second {
        --tone-ink: var(--fluvy-text-secondary);
      }
      /* the ring's own lifted as the knob is, and glowing in dark as a lit tick; the second's and a row's lie flat */
      .cp-lift {
        filter: drop-shadow(0 2px 2px rgb(0 0 0 / calc(0.24 * var(--fluvy-shade, 1))))
          drop-shadow(0 0 var(--fv-tick-glow, 0px) var(--tone-ink));
      }
      /* a tick or a point a pointer covers gives way, and comes back as it leaves */
      .cp-dial line,
      .cp-point {
        transition: opacity var(--fv-slow) var(--fv-ease);
      }
      .cp-dial .is-under {
        opacity: 0;
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
      /* a figure too wide for the small size steps to the extra-small one in the small one's line: the card is as tall
         whatever it reads (it was 4 shorter) */
      .cp-under .fv-readout--xs .fv-readout__value {
        height: 24px;
        line-height: 24px;
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
      .cp-reading .fv-dial__sub,
      .cp-under .fv-dial__sub {
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

  /** Where each arrow was last drawn, in degrees wound past a whole turn where it went round. */
  private readonly swung = new Map<Slot, number>();

  /**
   * The angle an arrow is drawn at: `deg` wound to within half a turn of where it stood, so it turns the short way
   * round (350° to 10° is 20° clockwise, never 340° back across the ring).
   */
  private swing(slot: Slot, deg: number): number {
    const last = this.swung.get(slot);
    const angle = last === undefined ? deg : last + ((((deg - last) % 360) + 540) % 360) - 180;
    this.swung.set(slot, angle);
    return angle;
  }

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
  /**
   * The head's glyph: a band's, the person's, the one set in Home Assistant, else Fluvy's own for what the card points
   * at where the entity has no glyph of ours (the wind's for a wind speed, a weather entity or a wind's bearing, the
   * sun's for the sun), else the entity's.
   */
  private headIcon(main: EntityView, band: Band | undefined): IconRef | string {
    const own = band?.icon ?? this.config!.icon;
    if (own) return own;
    if (main.registryIcon) return main.registryIcon;
    const pointsAt = (view: EntityView): GlyphName | undefined =>
      view.domain === 'sun'
        ? 'sun'
        : view.domain === 'weather' ||
            view.deviceClass === 'wind_speed' ||
            view.deviceClass === 'wind_direction'
          ? 'wind'
          : undefined;
    return pointsAt(main) ?? pointsAt(this.entity(this.directionId)) ?? iconOf(main);
  }

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

  /**
   * The ring's ticks every `step` from north, centred at `c`, from and to the radii its face gives each (`face.span`),
   * but where a cardinal point stands in their place: laid out once for a face and a ring (`ticks`).
   */
  private ticksOf(
    face: TickFace,
    c: number,
    step: number,
    offset: number,
    gaps: readonly Gap[],
  ): readonly Tick[] {
    const key = `${face.key}|${c}|${step}|${offset}|${gaps.map(([, half]) => half.toFixed(1))}`;
    if (this.ticks?.key === key) return this.ticks.all;
    const all: Tick[] = [];
    for (let bearing = 0; bearing < 360; bearing += step) {
      // a cardinal point stands where its ticks would
      if (gaps.some(([at, half]) => turn(bearing, at) <= half)) continue;
      const a = ((bearing + offset) * Math.PI) / 180;
      const [sin, cos] = [Math.sin(a), Math.cos(a)];
      const [from, to] = face.span(bearing);
      all.push({
        bearing,
        x1: c + from * sin,
        y1: c - from * cos,
        x2: c + to * sin,
        y2: c - to * cos,
        bar: face.bars && bearing % 90 === 0,
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

    // the ring from the column (`compassRadius`); the compact card's small one beside its figure
    const compact = this.variant === 'compact';
    const r = compact ? COMPACT_RADIUS : compassRadius(width);
    // the box's half: the ring, its ticks and the knob's 12 past them, on the 4 grid as the radius is
    const half = r + COMPASS_RIM;
    const inset = Math.max(0, Math.floor(width / 2 - half));
    const large = r >= 72;
    // a classic face's bezel (#247), the default; none on 1.24's ring
    const bezel = c.face === 'ring' ? undefined : bezelOf(r);
    // the figure in the ring's open centre (the full card's, from R 56), beside the compact card's small ring where
    // the column holds it there, else under the ring: by the column alone, never by the figure it writes now
    const besideRoom = width - 2 * half - 16;
    const where: 'inside' | 'beside' | 'under' = compact
      ? compassBeside(width)
        ? 'beside'
        : 'under'
      : r >= COMPASS_INSIDE
        ? 'inside'
        : 'under';
    // the word over the figure: the person's (a name: it ends in an ellipsis), else what the figure is, which leaves
    // where its line cannot hold it
    const room =
      where === 'inside'
        ? centreRoom(r, bezel, REACH[large ? 'l' : 's'].line)
        : where === 'beside'
          ? besideRoom
          : width;
    const label = gaugeLabel(c.label, reading.word, room, (text) =>
      this.head.ruler.width(where === 'inside' ? 'fv-dial__label-in' : 'fv-readout__label', text),
    );
    // the readout over the point and the degrees, where the figure is not in the ring: beside the compact card's ring
    // at the largest size it holds there, never cut. Under the ring a word that leaves keeps its line, as the gauge's
    // bar does: the card is as tall in every language; beside it the reading is centred on the ring and closes up
    const outside = (size: 'l' | 's' | 'xs'): TemplateResult =>
      html`${readout({
        label: label?.text ?? '',
        name: label ? !label.fits : false,
        ...(label || where === 'under' ? {} : { glyph: null }),
        value: reading.value,
        unit: reading.unit,
        size,
        ink: band?.ink,
      })}${this.renderPoint(reading, pointWords, degrees, room)}`;

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
        icon: fitted.icon ? this.headIcon(main, band) : null,
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
          bezel,
          half,
          inset: where === 'beside' ? 0 : inset,
          // the reading beside a compact card's ring keeps its 16: the ring's box is the letters' room there
          across: where === 'beside' ? half : inset + half,
          large,
          tone: unusable ? 'neutral' : tone,
          bearing,
          second,
          centre:
            where === 'inside'
              ? this.renderCentre(
                  reading,
                  label,
                  { r, bezel, half, large },
                  pointWords,
                  degrees,
                  band?.ink,
                )
              : nothing,
        })}
        ${
          where === 'beside'
            ? html`<div class="cp-reading">
                ${outside((['l', 's'] as const).find((size) => this.figureWidth(reading, size) <= besideRoom) ?? 'xs')}
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
   * track, north's notch, the bearing on it as its pointer marks it (the arrow across it, the chevron alone, a knob in
   * small, the arc across its sixteenth for lit ticks, a dot) and the second in the secondary ink — its name over its
   * figure, its point and its degrees. In a narrow row the degrees leave the line first, then the point (the ring says
   * it), then a band's words; where the figure would still not hold beside the circle, the circle and its ring give
   * way, the line taking the whole row.
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
              ${ico(this.headIcon(o.main, band), tone, {
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
    const mark = (deg: number | null, pointer: CompassPointer, slot: Slot, cls: string) => {
      if (deg === null) return nothing;
      const [x, y] = at(deg).split(' ');
      if (pointer === 'arrow')
        return arrowOf(
          29,
          R,
          ROW_DART,
          this.swing(slot, deg + offset),
          slot === 'second',
          pointsOut(c),
        );
      // the chevron alone across the track, 8 wide and 5 deep: no room for its circle beside the row's
      if (pointer === 'chevron')
        return svg`<path class="cp-vee ${cls}" d=${veeOf(29, 29 - R, 4, 2.5, pointsOut(c))} style=${turned(29, this.swing(slot, deg + offset))} />`;
      if (pointer === 'ticks')
        return svg`<path class="cp-arc ${cls}" d="M ${at(deg - 11.25)} A ${R} ${R} 0 0 1 ${at(deg + 11.25)}" />`;
      return pointer === 'knob'
        ? svg`<circle class="cp-mini-knob ${cls}" cx=${x} cy=${y} r="4.5" />`
        : svg`<circle class="cp-dot ${cls}" cx=${x} cy=${y} r="3" />`;
    };
    return svg`<svg viewBox="0 0 58 58" aria-hidden="true" data-measure="drawn">
      <circle class="cp-track" cx="29" cy="29" r=${R} />
      <path class="cp-notch" d="M ${at(0, R - 3)} L ${at(0, R + 3)}" />
      ${mark(second, c.secondary_indicator ?? 'dot', 'second', 'is-second')}
      ${mark(bearing, c.indicator ?? 'arrow', 'first', '')}
    </svg>`;
  }

  /**
   * The line under the figure: the point, and the degrees where the figure is not already them, one line in its
   * `room` whatever the bearing says: the degrees leave where they would not hold beside the point (Polish
   * "Zach-Pd-Zach" in half a section), as the row's do. In the ring's open centre (`dial`, its size) the point leaves
   * too where it alone would not hold (Polish "Wsch-Pd-Wsch" in a ring of 60, which ran under the pointer), the
   * degrees then said alone, or nothing where the figure is them: the line keeps its place.
   */
  private renderPoint(
    reading: Reading,
    point: string,
    degrees: string,
    room = Infinity,
    dial?: 'l' | 's',
  ): TemplateResult {
    const line = dial ? `fv-dial fv-dial--${dial} > fv-dial__sub` : 'fv-dial__sub';
    const holds = (tail: string): boolean =>
      room === Infinity ||
      this.head.ruler.width(`${line} cp-point-word`, point, 'fv-dial__sub', tail) <= room;
    const tail = ` · ${degrees}`;
    const said = !reading.bearing && degrees !== '';
    if (dial && !holds('')) return html`<p class="fv-dial__sub">${said ? degrees : '\u00a0'}</p>`;
    return html`<p class="fv-dial__sub">
      <span class="cp-point-word">${point}</span>${said && holds(tail) ? tail : nothing}
    </p>`;
  }

  /**
   * The open centre, as a gauge's dial writes it: the word over the figure, the figure at the largest size its disc
   * holds with its unit (the dial's sizes, measured), the point and the degrees under it; on a classic face each line
   * as wide as its open circle holds it where it stands (`centreRoom`).
   */
  private renderCentre(
    reading: Reading,
    label: ReturnType<typeof gaugeLabel>,
    ring: {
      readonly r: number;
      readonly bezel: Bezel | undefined;
      readonly half: number;
      readonly large: boolean;
    },
    point: string,
    degrees: string,
    ink: string | undefined,
  ): TemplateResult {
    const { r, bezel, half, large } = ring;
    const disc = dialDiscRadius(r);
    const reach = REACH[large ? 'l' : 's'];
    const unitWidth = reading.unit
      ? 4 + textWidth(reading.unit, { size: large ? 18 : 14, weight: 600 })
      : 0;
    const holds = (size: number): boolean =>
      textWidth(reading.value, { size, weight: 600, tracking: -0.02, tabular: true }) <=
      centreRoom(r, bezel, reach.figure) - unitWidth;
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
      ${this.renderPoint(reading, point, degrees, centreRoom(r, bezel, reach.line), large ? 'l' : 's')}
    </div>`;
  }

  /**
   * The ring: its face, north turned to `north_offset` and its letters upright (a classic compass's bezel, its band with
   * the ticks across it and the four letters large outside it, or the gauge's ticks with the letters in their place),
   * the second bearing under the first, each as its pointer marks it, and the centre over it. `across` is the room
   * from the ring's centre to its column's nearer edge: what the letters may take.
   */
  private renderDial(o: {
    readonly r: number;
    readonly bezel: Bezel | undefined;
    readonly half: number;
    readonly inset: number;
    readonly across: number;
    readonly large: boolean;
    readonly tone: Tone;
    readonly bearing: number | null;
    readonly second: number | null;
    readonly centre: TemplateResult | typeof nothing;
  }): TemplateResult {
    const c = this.config!;
    const { r, bezel, half } = o;
    const box = half * 2;
    const offset = offsetOf(c);
    const showTicks = c.show_ticks !== false;
    // where the pointers ride: a classic face's band's middle, else the ring
    const track = bezel?.track ?? r;
    const at = (bearing: number, radius: number): Point => {
      const a = ((bearing + offset) * Math.PI) / 180;
      return [half + radius * Math.sin(a), half - radius * Math.cos(a)];
    };
    const words =
      c.show_cardinals === false
        ? []
        : CARDINALS.map(([bearing, key]) => [bearing, weatherWords(this.hass, key)] as const);
    // a classic face's letters outside its band, where their column holds them at one of their sizes
    const outside =
      bezel && words.length
        ? classicLetters(
            words,
            bezel,
            offset,
            { across: o.across, down: half },
            letterSizes(r),
            (word, size) => textWidth(word, { size, weight: 700 }),
          )
        : null;
    // else in their ticks' place: the ring's ticks' middle, or the band's
    const place = bezel ? track : r + TICK / 2;
    const letters: readonly Letter[] =
      outside ??
      words.map(([bearing, word]): Letter => {
        const [x, y] = at(bearing, place);
        return {
          bearing,
          word,
          size: POINT_FACE.size,
          x: x - half,
          y: y - half,
          width: textWidth(word, POINT_FACE),
          height: POINT_FACE.size,
        };
      });
    // a point's word in their place keeps the ticks (and the band) clear: its box across the ring, 2 either side
    const gaps: readonly Gap[] = outside
      ? []
      : letters.map(({ bearing, width, height }) => {
          const a = ((bearing + offset) * Math.PI) / 180;
          const across = (Math.abs(width * Math.cos(a)) + Math.abs(height * Math.sin(a))) / 2 + 2;
          return [bearing, (Math.asin(Math.min(1, across / place)) * 180) / Math.PI] as const;
        });
    const face: TickFace = bezel
      ? { key: `classic|${r}`, span: (bearing) => classicSpan(bezel, bearing), bars: true }
      : {
          key: `ring|${r}`,
          span: (bearing) => [r, r + (bearing % 45 === 0 ? TICK : TICK * 0.6)],
          bars: false,
        };
    // a classic face's every 7.5° (three to a sixteenth, its bearings' marks among them), every 11.25° on a small ring
    const step = bezel ? (r >= 56 ? 7.5 : 11.25) : r >= 64 ? 5 : 10;
    const ticks = this.ticksOf(face, half, step, offset, gaps);
    const primary = c.indicator ?? 'arrow';
    const secondary = c.secondary_indicator ?? 'dot';
    // the knob its ring carries, and the arrow and the chevron in its place, pointing out or in
    const size = knobSize(r);
    const dart = dartOf(size);
    const outward = pointsOut(c);
    // a dot on a classic face's band; outside the ring's ticks
    const dotAt = (bearing: number): Point => at(bearing, bezel ? track : r + TICK + 6);
    // what each pointer covers, by its outline: an arrow (and a dot on a band) the ticks under it, 4 clear of a tick
    // (its 1 either side of the line); any of them a point's word, 3 clear of it; a knob and a chevron by their halo,
    // which cuts the ticks
    const marks = (
      [
        [o.second, secondary],
        [o.bearing, primary],
      ] as const
    ).flatMap(([bearing, pointer]): { clears: boolean; outline: Point[] }[] => {
      if (bearing === null || pointer === 'ticks') return [];
      if (pointer === 'arrow')
        return [
          { clears: true, outline: dartOutline(half, track, dart, bearing + offset, outward) },
        ];
      if (pointer === 'dot') return [{ clears: !!bezel, outline: roundOutline(dotAt(bearing), 3) }];
      return [{ clears: false, outline: roundOutline(at(bearing, track), size / 2 + 6) }];
    });
    const under = (tick: Tick): boolean =>
      marks.some(
        ({ clears, outline }) =>
          clears &&
          meets(
            outline,
            [
              [tick.x1, tick.y1],
              [tick.x2, tick.y2],
            ],
            4,
          ),
      );
    const covered = ({ x, y, width, height }: Letter): boolean =>
      marks.some(({ outline }) =>
        meets(
          outline,
          [
            [half + x - width / 2, half + y - height / 2],
            [half + x + width / 2, half + y - height / 2],
            [half + x + width / 2, half + y + height / 2],
            [half + x - width / 2, half + y + height / 2],
          ],
          3,
        ),
      );
    // the ticks across a bearing's sixteenth: lit by a pointer of ticks
    const across = (bearing: number | null, pointer: CompassPointer) => (tick: Tick) =>
      pointer === 'ticks' && bearing !== null && turn(tick.bearing, bearing) <= 11.25;
    const lit = across(o.bearing, primary);
    const litSecond = across(o.second, secondary);
    // a lit tick on a classic face spans its band, the sixteenth one lit arc; a bar keeps its ends
    const litOf = (tick: Tick): Tick => {
      if (!bezel || tick.bar) return tick;
      const [[x1, y1], [x2, y2]] = [
        at(tick.bearing, bezel.inner + 1),
        at(tick.bearing, bezel.outer - 1),
      ];
      return { ...tick, x1, y1, x2, y2 };
    };
    const line = (tick: Tick, cls: string) =>
      svg`<line x1=${tick.x1.toFixed(2)} y1=${tick.y1.toFixed(2)} x2=${tick.x2.toFixed(2)} y2=${tick.y2.toFixed(2)} class="${cls} ${tick.bar ? 'is-bar' : ''} ${under(tick) ? 'is-under' : ''}" />`;
    const dot = (bearing: number | null, pointer: CompassPointer, cls: string) => {
      if (bearing === null || pointer !== 'dot') return nothing;
      const [x, y] = dotAt(bearing);
      return svg`<circle cx=${x.toFixed(2)} cy=${y.toFixed(2)} r="3" class=${cls} />`;
    };
    // where an arrow or a chevron is drawn, wound the short way round from where it stood: once a drawing, the
    // second's first
    const angleOf = (slot: Slot, bearing: number | null, kind: CompassPointer): number | null =>
      bearing !== null && (kind === 'arrow' || kind === 'chevron')
        ? this.swing(slot, bearing + offset)
        : null;
    const angles: Readonly<Record<Slot, number | null>> = {
      second: angleOf('second', o.second, secondary),
      first: angleOf('first', o.bearing, primary),
    };
    // a chevron's halo, over the band and the ticks it cuts
    const halo = (slot: Slot, kind: CompassPointer) => {
      const angle = angles[slot];
      return kind === 'chevron' && angle !== null ? haloOf(half, track, size, angle) : nothing;
    };
    // a pointer over the ring, each a layer of its own, the second's under the first's: a knob, or the drawing of an
    // arrow or a chevron
    const pointer = (slot: Slot, bearing: number | null, kind: CompassPointer, tone: Tone) => {
      if (bearing === null) return nothing;
      const angle = angles[slot];
      if (angle !== null)
        return html`<svg
          class=${slot === 'first' ? 'cp-lift' : nothing}
          width=${box}
          height=${box}
          viewBox="0 0 ${box} ${box}"
          aria-hidden="true"
        >
          ${
            kind === 'chevron'
              ? chevronOf(half, track, size, angle, slot === 'second', outward)
              : arrowOf(half, track, dart, angle, slot === 'second', outward)
          }
        </svg>`;
      if (kind !== 'knob') return nothing;
      const [x, y] = at(bearing, track);
      // half pixels: crisp at 2× and 3×, never off the ring
      const knobAt = (v: number): number => Math.round((v - size / 2) * 2) / 2;
      return html`<span
        class="fv-knob fv-knob--${tone}"
        data-measure="value"
        style="translate:${knobAt(x)}px ${knobAt(y)}px;width:${size}px;height:${size}px"
      ></span>`;
    };
    // a classic face's band (in arcs between the letters standing in its place) and its hairline; without its ticks,
    // the ring a 2 hairline, the knob's track
    const ground = bezel
      ? svg`${
          gaps.length
            ? svg`<path class="cp-band" d=${arcsOf(half, track, offset, gaps)} style="stroke-width:${bezel.band}px" />`
            : svg`<circle class="cp-band" cx=${half} cy=${half} r=${track} style="stroke-width:${bezel.band}px" />`
        }${bezel.line === null ? nothing : svg`<circle class="cp-line" cx=${half} cy=${half} r=${bezel.line} />`}`
      : showTicks
        ? nothing
        : svg`<circle class="cp-ring" cx=${half} cy=${half} r=${r} />`;
    return html`<div
      class="fv-dial fv-dial--${o.large ? 'l' : 's'} fv-dial--gauge fv-dial--${o.tone} cp-dial ${bezel ? 'is-classic' : ''} ${o.tone === 'neutral' && o.bearing === null ? 'is-off' : ''}"
      style="margin-left:${o.inset}px;width:${box}px;height:${box}px"
    >
      <svg width=${box} height=${box} viewBox="0 0 ${box} ${box}" aria-hidden="true">
        ${ground}
        ${ticks.map((tick) =>
          lit(tick)
            ? line(litOf(tick), 'tk-on')
            : litSecond(tick)
              ? svg`<g class="fv-tone--neutral">${line(litOf(tick), 'tk-on')}</g>`
              : showTicks
                ? line(tick, 'tk-off')
                : nothing,
        )}
        ${halo('second', secondary)}${dot(o.second, secondary, 'dl-current')}
        ${halo('first', primary)}${dot(o.bearing, primary, 'cp-dot')}
      </svg>
      ${letters.map(
        (letter) =>
          html`<span
            class="cp-point ${letter.bearing === 0 ? 'is-north' : ''} ${outside ? 'is-large' : ''} ${covered(letter) ? 'is-under' : ''}"
            aria-hidden="true"
            style="left:${(half + letter.x).toFixed(2)}px;top:${(half + letter.y).toFixed(2)}px${outside ? `;font-size:${letter.size}px` : ''}"
            >${letter.word}</span
          >`,
      )}
      ${o.centre}${pointer('second', o.second, secondary, 'neutral')}${pointer('first', o.bearing, primary, o.tone)}
    </div>`;
  }
}
