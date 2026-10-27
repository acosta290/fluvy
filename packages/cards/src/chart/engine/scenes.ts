import { strings, type GaugePreset, type HomeAssistant, type KeyOf } from '@fluvy/core';
import { textWidth } from '@fluvy/ui';
import { html, nothing, svg, type SVGTemplateResult, type TemplateResult } from 'lit';
import type { GaugeOptions } from './gauge.js';

/**
 * The gauges that move with what they read (approved 2026-10-26): each a small scene in the gauge's room whose motion
 * is its sensor's own variable — the liquid's two slow waves, the tank's bubbles while it fills and as fast, the
 * battery's while it charges, the pulse's rings that beat faster with more power, the air's streamlines as fast as the
 * wind, the sun's rays that lengthen and turn with what it gives, and the temperature's sky: snow falling on a drift
 * when it is cold, a mild sun and a drifting cloud, heat haze over dry ground, a desert with its saguaros from 35 °C.
 * The reading is the card's figure in Fluvy's type, placed by rule: in a box it never crosses the waterline or the
 * weather (`waterPlan` and `skyPlan` say where everything stands, and are what is drawn); under a mark it is centred,
 * as the dial's figure is.
 *
 * Motion is CSS alone, one keyframe set in the engine's sheet (`styles.ts`), on transform, opacity and the dash offset
 * only — no SVG filter, nothing laid out again. A gauge told not to move (`animate: false`, the card's or the
 * house's), or a system that asks for less motion, rests on its first frame: still a wave, never a flat line; the
 * bubbles, the rings and the snow, which exist only moving, are gone. A gauge without a reading keeps its room and its
 * anatomy, still and grey, its figure "—".
 */

const words = strings('chart');
const px = (n: number): string => n.toFixed(2);
const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));
const up4 = (n: number): number => Math.ceil(n / 4) * 4;
const down4 = (n: number): number => Math.floor(n / 4) * 4;

/** A rectangle in a scene's room. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Whether two boxes share any area (touching edges do not). */
export const meets = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A scene's room: its width and height, and whether it is a tile's (the smaller type, the closer margins). */
export interface Room {
  readonly w: number;
  readonly h: number;
  readonly small: boolean;
}

/** A room narrower than this is a tile's: a gauge in the 152 and 172 columns. */
const TILE_BELOW = 168;

/** How far a box's reading and the art keep from its edges. */
const insetOf = (room: Room): number => (room.small ? 12 : 16);

/* ---------- the reading ---------- */

export type ReadingSize = 'l' | 'm' | 's';

/** The reading's type: the figure (its value bold, its unit after it), and a word under it. */
const TYPE: Readonly<
  Record<ReadingSize, { value: number; line: number; unit: number; word: number; wordLine: number }>
> = {
  l: { value: 32, line: 36, unit: 15, word: 13, wordLine: 20 },
  m: { value: 24, line: 28, unit: 13, word: 12, wordLine: 16 },
  s: { value: 20, line: 24, unit: 12, word: 12, wordLine: 16 },
};

/** A reading laid out: what it says, in which type, and the box it takes. */
export interface Reading {
  readonly value: string;
  readonly unit: string;
  readonly word: string;
  readonly size: ReadingSize;
  readonly w: number;
  readonly h: number;
}

/**
 * The reading in the largest type whose figure holds `room` across (a tile's from the middle one), its word under
 * it where the word holds the width and both lines hold `tall` — else the figure alone: a word gives way, a figure
 * never.
 */
export function fitReading(
  value: string,
  unit: string,
  word: string,
  room: number,
  tall: number,
  small: boolean,
): Reading {
  const figure = (size: ReadingSize): number => {
    const t = TYPE[size];
    return (
      textWidth(value, { size: t.value, weight: 700, tracking: -0.02, tabular: true }) +
      (unit ? 3 + textWidth(unit, { size: t.unit, weight: 500 }) : 0)
    );
  };
  const sizes: ReadingSize[] = small ? ['m', 's'] : ['l', 'm', 's'];
  const size = sizes.find((each) => figure(each) <= room) ?? 's';
  const t = TYPE[size];
  const said = word ? textWidth(word, { size: t.word, weight: 500 }) : 0;
  const keep = word !== '' && said <= room && t.line + t.wordLine <= tall;
  return {
    value,
    unit,
    word: keep ? word : '',
    size,
    w: Math.ceil(Math.max(figure(size), keep ? said : 0)),
    h: t.line + (keep ? t.wordLine : 0),
  };
}

/** The reading drawn: placed in a box (`at`, white in the water), or in the flow under a mark, centred. */
function reading(r: Reading, at?: { x: number; y: number; wet?: boolean }): TemplateResult {
  return html`<div
    class="fc-reading fc-reading--${r.size} ${at ? '' : 'fc-reading--under'} ${at?.wet ? 'is-wet' : ''}"
    style=${at ? `left:${at.x}px;top:${at.y}px` : ''}
  >
    <span class="fc-reading__figure"
      ><b data-measure="value">${r.value}</b
      >${r.unit ? html`<span>${r.unit}</span>` : nothing}</span
    >${r.word ? html`<span class="fc-reading__word">${r.word}</span>` : nothing}
  </div>`;
}

/* ---------- what a scene reads ---------- */

/** The range a scene reads its value on: a percentage on its whole, anything else on the card's. */
const rangeOf = (o: GaugeOptions): readonly [number, number] =>
  o.reads?.unit === '%' ? [0, 100] : [o.min, o.max];

/** The value's share of its range, 0 … 1; null when there is none to show. */
export function shareOf(o: GaugeOptions): number | null {
  const [low, high] = rangeOf(o);
  return o.value === null || !Number.isFinite(o.value) || !(high > low)
    ? null
    : clamp((o.value - low) / (high - low), 0, 1);
}

/** How fast the reading climbs, in shares of its range an hour (the card's `rise`): 0 when it holds or falls. */
export function climbOf(o: GaugeOptions): number {
  const [low, high] = rangeOf(o);
  return o.rise && high > low ? Math.max(0, o.rise / (high - low)) : 0;
}

/** Climbing at all — half a percent of the range an hour: a tank filling, a battery charging. */
const CLIMBING = 0.005;

/** A temperature in °C, from the unit it is read in. */
export const celsius = (value: number, unit: string | undefined): number =>
  unit === '°F' ? ((value - 32) * 5) / 9 : unit === 'K' ? value - 273.15 : value;

/** A speed's factor to km/h, by its unit (a unit that is no speed, a ventilation's flow, has none). */
const KMH: Readonly<Record<string, number>> = {
  'km/h': 1,
  'm/s': 3.6,
  mph: 1.609,
  kn: 1.852,
  'ft/s': 1.097,
};

/** The figure a scene writes: its value and unit, or "—" alone. */
const textOf = (o: GaugeOptions, share: number | null): { value: string; unit: string } =>
  share === null || o.value === null
    ? { value: '—', unit: '' }
    : { value: o.format(o.value), unit: o.unit ?? '' };

/** The engine's word for what a scene shows (`chart.gauge.*`). */
const say = (hass: HomeAssistant | undefined, key: KeyOf<'chart'>): string => words(hass, key);

/** A scene's root: its room, its tone, and whether it moves. */
const root = (kind: string, room: Room, tone: string, moving: boolean): string =>
  `fc-scene ${kind} ${room.small ? 'fc-scene--small' : ''} fv-tone--${tone} ${moving ? '' : 'is-still'}`;

/* ---------- the water: the liquid and the tank ---------- */

/** Where the water stands in a box `h` tall at `share` of its range, kept off the floor and the brim (8 … 92 %). */
export const waterline = (h: number, share: number): number => h - h * clamp(share, 0.08, 0.92);

/**
 * A wave along `y`, `amp` either side of it, one wavelength every `period`, from `x0` past `x1`: quadratic arcs, each
 * the mirror of the last (`t`), so the line is smooth and the path short. Closed down to `floor` it is the water; left
 * open it is a streamline.
 */
export function wavePath(
  x0: number,
  x1: number,
  y: number,
  amp: number,
  period: number,
  floor?: number,
): string {
  const half = period / 2;
  let d = `M${px(x0)},${px(y)} q${px(half / 2)},${px(-2 * amp)} ${px(half)},0`;
  for (let x = x0 + half; x < x1; x += half) d += ` t${px(half)},0`;
  return floor === undefined ? d : `${d} V${px(floor)} H${px(x0)} Z`;
}

/** Where a water scene draws its line, puts its reading and lets its bubbles rise. */
export interface WaterPlan {
  /** The waterline; the box's floor when there is no reading (no water). */
  readonly y: number;
  /** How far the waves reach either side of the line. */
  readonly amp: number;
  readonly reading?: Box & { readonly wet: boolean };
  /** Where bubbles rise: from the floor to under the line, in the right part, clear of a reading in the water. */
  readonly bubbles?: Box;
}

/**
 * The water's plan: its line at the share, and the reading in the larger of water and air — under the waves' reach
 * by 4 when it is half full or more, over it else — on the 4 grid: never across the line.
 */
export function waterPlan(
  room: Room,
  share: number | null,
  amp: number,
  read?: Pick<Reading, 'w' | 'h'>,
): WaterPlan {
  const { w, h } = room;
  const y = share === null ? h : waterline(h, share);
  const wet = share !== null && h - y >= y;
  const box = read && {
    x: insetOf(room),
    y: wet ? up4(y + amp + 4) : down4(y - amp - 4 - read.h),
    w: read.w,
    h: read.h,
    wet,
  };
  const from = Math.max(w * 0.55, box?.wet ? box.x + box.w + 8 : 0);
  const rise = { x: from, y: y + amp + 2, w: w * 0.95 - from, h: h - y - amp - 2 };
  return {
    y,
    amp,
    ...(box ? { reading: box } : {}),
    ...(share !== null && rise.w >= 12 && rise.h >= 12 ? { bubbles: rise } : {}),
  };
}

/** The room a reading has in the water's larger part, clear of the waves and of the box's edge. */
const roomBeside = (room: Room, share: number | null, amp: number): number => {
  const y = share === null ? room.h : waterline(room.h, share);
  return Math.max(y, room.h - y) - amp - 8 - insetOf(room);
};

/** Bubbles rising through `box` from its floor, `count` of them, each about `speed` seconds, staggered. */
function bubbles(box: Box, count: number, speed: number): SVGTemplateResult[] {
  return Array.from({ length: count }, (_unused, i) => {
    const r = 1.5 + ((i * 53) % 3);
    const x = box.x + r + (((i * 37 + 13) % 100) / 100) * Math.max(0, box.w - 2 * r);
    const d = speed * (0.75 + ((i * 29) % 50) / 100);
    return svg`<circle
      class="fc-bubble"
      cx=${px(x)}
      cy=${px(box.y + box.h - r)}
      r=${r}
      style=${`--d:${px(d)}s;--delay:${px(-(i * d) / count)}s;--rise:${px(2 * r - box.h)}px`}
    />`;
  });
}

/**
 * The liquid (a humidity, any percentage): two slow waves (9 s and 14 s), a wavelength across the box, the reading in
 * the larger of water and air. The tank (a volume, a level): shorter, quicker waves, and bubbles in its right part
 * while it fills, as many and as fast as it fills — none at rest. `bare`: the drawing alone (the card writes the
 * reading elsewhere: the humidity's, over it).
 */
function water(o: GaugeOptions, room: Room, tank: boolean): TemplateResult {
  const { w, h, small } = room;
  const share = shareOf(o);
  const climb = tank ? climbOf(o) : 0;
  const filling = share !== null && climb > CLIMBING;
  // filling briskly (a third of the tank an hour: 12 L a minute into 1 000), twice the bubbles, twice as fast
  const brisk = climb >= 0.3;
  const amp = tank ? o.style.wave * (small ? 0.43 : 0.57) : o.style.wave;
  const text = textOf(o, share);
  const read = o.bare
    ? undefined
    : fitReading(
        text.value,
        text.unit,
        filling ? say(o.hass, 'gauge.filling') : (o.label ?? ''),
        w - 2 * insetOf(room),
        roomBeside(room, share, amp),
        small,
      );
  const plan = waterPlan(room, share, amp, read);
  const period = tank ? (small ? 60 : 90) : w;
  return html`<div
    class=${root(`fc-scene--box fc-water ${tank ? 'fc-water--tank' : ''}`, room, share === null ? 'neutral' : o.tone, o.style.animate)}
    style="width:${w}px;height:${h}px"
    data-measure="drawn"
  >
    <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true">
      ${
        share === null
          ? nothing
          : // two waves, the lighter one ahead of the other by a third of its length
            svg`<path
              class="fc-wave fc-water__back"
              d=${wavePath(0, w + 2 * period, plan.y, amp, period, h)}
              style=${`--d:${tank ? 11 : 9}s;--shift:-${period}px`}
            /><path
              class="fc-wave fc-water__front"
              d=${wavePath(-period / 3, w + 2 * period, plan.y + (tank ? 3 : 0), amp * 0.7, period, h)}
              style=${`--d:${tank ? 7 : 14}s;--shift:-${period}px`}
            />`
      }
      ${
        filling && plan.bubbles
          ? bubbles(plan.bubbles, (small ? 4 : 6) * (brisk ? 2 : 1), brisk ? 1.8 : 3.4)
          : nothing
      }
    </svg>
    ${read && plan.reading ? reading(read, plan.reading) : nothing}
  </div>`;
}

/* ---------- the sky: a temperature ---------- */

export type Weather = 'cold' | 'mild' | 'warm' | 'extreme' | 'none';

/** The weather a temperature feels like: cold under 16 °C, mild to 24, warm to 35, extreme heat from there. */
export const weatherOf = (c: number | null): Weather =>
  c === null ? 'none' : c < 16 ? 'cold' : c < 24 ? 'mild' : c < 35 ? 'warm' : 'extreme';

/** The comfort's word: cold under 8 °C, cool to 16, comfortable to 24, warm to 30, hot to 35, extreme heat. */
const comfortOf = (c: number): KeyOf<'chart'> =>
  c < 8
    ? 'gauge.cold'
    : c < 16
      ? 'gauge.cool'
      : c < 24
        ? 'gauge.comfortable'
        : c < 30
          ? 'gauge.warm'
          : c < 35
            ? 'gauge.hot'
            : 'gauge.extreme';

export interface Sun {
  readonly x: number;
  readonly y: number;
  /** The disc's radius, and its longest ray. */
  readonly r: number;
  readonly ray: number;
}

/** Where the sky draws its ground, its reading and every part of its weather. */
export interface SkyPlan {
  /** The ground's line, and how high its hill rises over it. */
  readonly ground: number;
  readonly lift: number;
  readonly reading: Box;
  readonly sun?: Sun;
  /** Snowflakes: where each starts, its size, how far it falls (swaying 6 either way). */
  readonly flakes: readonly {
    readonly x: number;
    readonly y: number;
    readonly r: number;
    readonly fall: number;
  }[];
  /** The cloud: its left end and its baseline, its width and scale, and how far it drifts. */
  readonly cloud?: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly s: number;
    readonly span: number;
  };
  /** The haze: short wavy strokes off the ground, each rising `rise`. */
  readonly haze: readonly {
    readonly x: number;
    readonly y: number;
    readonly len: number;
    readonly rise: number;
  }[];
  /** Saguaros standing on the ground: where, how tall, how thick. */
  readonly cacti: readonly { readonly x: number; readonly h: number; readonly w: number }[];
}

/** How high each weather's ground rises, in a tile's room and a card's: the drift, the hill, dry ground, the dunes. */
const LIFT: Readonly<Record<Weather, readonly [number, number]>> = {
  cold: [5, 7],
  mild: [4, 6],
  warm: [4, 6],
  extreme: [7, 10],
  none: [3, 3],
};

/** How much larger the sun's disc and longer its rays as the heat rises: a stronger sun, a blazing one. */
const SUN_GROWS = { mild: [1, 1], warm: [1.1, 1.15], extreme: [1.2, 1.35] } as const;

/** The sun's box: its rays and its halo. */
export const sunBox = (sun: Sun): Box => {
  const reach = sun.r + Math.max(7, 4 + sun.ray);
  return { x: sun.x - reach, y: sun.y - reach, w: 2 * reach, h: 2 * reach };
};

/** Every part of the sky's weather as the box it covers through its motion: what the reading must never meet. */
export function weatherBoxes(plan: SkyPlan): Box[] {
  return [
    ...(plan.sun ? [sunBox(plan.sun)] : []),
    ...plan.flakes.map((f) => ({
      x: f.x - f.r - 6,
      y: f.y - f.r,
      w: 2 * f.r + 12,
      h: f.fall + 2 * f.r,
    })),
    ...(plan.cloud
      ? [
          {
            x: plan.cloud.x,
            y: plan.cloud.y - 14 * plan.cloud.s,
            w: plan.cloud.w + plan.cloud.span,
            h: 20 * plan.cloud.s,
          },
        ]
      : []),
    ...plan.haze.map((s) => ({ x: s.x, y: s.y - 2.5 + s.rise, w: s.len, h: 5 - s.rise })),
    ...plan.cacti.map((c) => ({
      x: c.x - c.h * 0.32 - c.w / 2,
      y: plan.ground - c.h - c.w / 2,
      w: c.h * 0.6 + c.w,
      h: c.h + c.w / 2 + 2,
    })),
    { x: 0, y: plan.ground - plan.lift - 2, w: Number.MAX_SAFE_INTEGER, h: plan.lift + 2 },
  ];
}

/**
 * The sky's plan in a room for a reading. The ground a sixth of the room from its foot; the reading in the top left;
 * the sun in the top right corner, or under the reading where the reading leaves it no room there; the snow, the
 * cloud and the haze right of the reading (from half the room, two thirds of a tile's), or under it where the reading
 * is too wide for that. Everything grows a little with a taller room (`k`).
 */
export function skyPlan(room: Room, weather: Weather, read: Pick<Reading, 'w' | 'h'>): SkyPlan {
  const { w, h, small } = room;
  const ground = h - Math.round(h / 6);
  const k = clamp(h / (small ? 120 : 132), 1, 1.4);
  const box: Box = { x: insetOf(room), y: 12, w: read.w, h: read.h };
  const under = box.y + box.h + 8;
  const from = w * (small ? 0.68 : 0.52);
  const beside = Math.max(from, box.x + box.w + 8);
  // the weather's part of the sky: beside the reading where that leaves it room, else under the reading
  const part: Box =
    w - 6 - beside >= (small ? 24 : 40)
      ? { x: beside, y: 0, w: w - 6 - beside, h: ground }
      : { x: from, y: under, w: w - 6 - from, h: ground - under };
  const lift = LIFT[weather][small ? 0 : 1] * k;
  let sun: Sun | undefined;
  if (weather === 'mild' || weather === 'warm' || weather === 'extreme') {
    const [grow, longer] = SUN_GROWS[weather];
    const r = (small ? 6.5 : 11) * grow * k;
    const ray = (small ? 3 : 6) * longer * k;
    // the corner beside the reading, else under it where it has more room there; shrunk to the room it has
    const corner = (w - 6 - (box.x + box.w + 8)) / 2;
    const below = (ground - 4 - under) / 2;
    const reach = r + Math.max(7, 4 + ray);
    const room = reach <= corner ? corner : Math.max(corner, below);
    const fit = clamp(Math.min((room - 7) / r, (room - 4) / (r + ray)), 0, 1);
    const size = r * fit + Math.max(7, 4 + ray * fit);
    sun = {
      x: w - 6 - size,
      y: room === corner ? 6 + size : under + size,
      r: r * fit,
      ray: ray * fit,
    };
  }
  const flakes =
    weather !== 'cold'
      ? []
      : Array.from({ length: small ? 6 : 10 }, (_unused, i) => {
          const r = (small ? 2.5 : 3) + (i % 3) * 0.7;
          const x =
            part.x + 6 + r + (((i * 41 + 7) % 100) / 100) * Math.max(0, part.w - 12 - 2 * r);
          // from just over the part's top (the sky's own, or just under the reading) down into the drift
          const y = part.y === 0 ? -r - 2 : part.y + r;
          return { x, y, r, fall: ground + 2 - y };
        });
  // the cloud drifts across over the hill: right of the reading, or from the sky's part where it passes under it
  const cw = (small ? 26 : 34) * k;
  const baseline = ground - 12 * k;
  const left = baseline - 14 * k - 8 > box.y + box.h ? from : part.x;
  const cloud =
    weather === 'mild'
      ? { x: left, y: baseline, w: cw, s: k, span: Math.max(0, w - 6 - left - cw) }
      : undefined;
  const haze =
    weather === 'warm' || weather === 'extreme'
      ? Array.from({ length: small ? 2 : 3 }, (_unused, i) => ({
          x: w * (small ? 0.42 : 0.5) + i * w * (small ? 0.22 : 0.15),
          y: ground - 6 - lift - i * (small ? 5 : 8),
          len: small ? 16 : 26,
          rise: small ? -10 : -14,
        }))
      : [];
  const cacti =
    weather !== 'extreme'
      ? []
      : small
        ? [{ x: w * 0.74, h: 18 * k, w: 4.5 }]
        : [
            { x: w * 0.55, h: 30 * k, w: 6 },
            { x: w * 0.76, h: 20 * k, w: 5 },
          ];
  return {
    ground,
    lift,
    reading: box,
    ...(sun ? { sun } : {}),
    flakes,
    ...(cloud ? { cloud } : {}),
    haze,
    cacti,
  };
}

/** A snowflake: three strokes through its centre, at 0°, 60° and 120°. */
const flake = (x: number, y: number, r: number): SVGTemplateResult[] =>
  [0, 60, 120].map((a) => {
    const dx = Math.cos((a * Math.PI) / 180) * r;
    const dy = Math.sin((a * Math.PI) / 180) * r;
    return svg`<line x1=${px(x - dx)} y1=${px(y - dy)} x2=${px(x + dx)} y2=${px(y + dy)} />`;
  });

/** Fluvy's sun, outlined: its disc in the solar fill, its ring, twelve rays turning (`spin` s), its halo breathing. */
function sunArt(sun: Sun, spin: number, breath: number, small: boolean): SVGTemplateResult {
  const rays = Array.from({ length: 12 }, (_unused, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const r0 = sun.r + 4;
    const r1 = r0 + sun.ray * (i % 2 ? 0.65 : 1);
    return svg`<line
      x1=${px(sun.x + Math.cos(a) * r0)}
      y1=${px(sun.y + Math.sin(a) * r0)}
      x2=${px(sun.x + Math.cos(a) * r1)}
      y2=${px(sun.y + Math.sin(a) * r1)}
    />`;
  });
  return svg`<circle
      class="fc-breath fc-sky__halo"
      cx=${px(sun.x)}
      cy=${px(sun.y)}
      r=${px(sun.r + 7)}
      style=${`--d:${breath}s;--o1:.55;--o2:.9`}
    /><g
      class="fc-spin fc-sky__rays"
      stroke-width=${small ? 1.75 : 2.25}
      style=${`--d:${spin}s;transform-origin:${px(sun.x)}px ${px(sun.y)}px`}
    >${rays}</g
    ><circle class="fc-sky__sun" cx=${px(sun.x)} cy=${px(sun.y)} r=${px(sun.r)} stroke-width=${small ? 2 : 2.5} />`;
}

/** A saguaro standing on the ground: its trunk and two arms, round-capped strokes. */
function cactus(c: SkyPlan['cacti'][number], ground: number): SVGTemplateResult {
  const armY = ground - c.h * 0.55;
  const armX = c.h * 0.32;
  return svg`<path
    class="fc-sky__cactus"
    stroke-width=${c.w}
    d=${`M${px(c.x)},${px(ground + 2)} V${px(ground - c.h)} M${px(c.x)},${px(armY + 4)} H${px(c.x - armX)} V${px(armY - c.h * 0.22)} M${px(c.x)},${px(armY - 2)} H${px(c.x + armX * 0.85)} V${px(armY - c.h * 0.32)}`}
  />`;
}

/** A short wavy stroke of haze, `len` long, rising off the ground. */
function hazeArt(s: SkyPlan['haze'][number], i: number, extreme: boolean): SVGTemplateResult {
  let d = `M${px(s.x)},${px(s.y)}`;
  for (let step = 0; step < 4; step++)
    d += ` q${px(s.len / 8)},${step % 2 ? 2.5 : -2.5} ${px(s.len / 4)},0`;
  return svg`<path
    class="fc-haze"
    d=${d}
    style=${`--d:${extreme ? 2.2 : 3.2}s;--delay:${px(-i * 0.9)}s;--rise:${s.rise}px`}
  />`;
}

/** The fair cloud, from its left end along its baseline, `w` long, drawn at scale `s`. */
const cloudPath = (c: NonNullable<SkyPlan['cloud']>): string => {
  const s = c.s;
  return `M${px(c.x)},${px(c.y)} h${px(c.w)} a${px(6 * s)},${px(6 * s)} 0 0 0 ${px(-2 * s)},${px(-11.6 * s)} a${px(8 * s)},${px(8 * s)} 0 0 0 ${px(-15 * s)},${px(-2 * s)} a${px(6 * s)},${px(6 * s)} 0 0 0 ${px(17 * s - c.w)},${px(7.6 * s)} z`;
};

/**
 * The sky over the ground (a temperature): no water — a sky tinted by the comfort's tone and the weather it feels
 * like. Snow falling on a drift when it is cold; a mild sun turning slowly (36 s) and a fair cloud drifting across,
 * over a green hill; a stronger sun (18 s) and heat haze rising off dry ground when it is warm; a blazing sun (9 s, its
 * halo breathing at 2.2 s) over dunes with saguaros from 35 °C. The reading in the sky's top left, its word under it.
 */
function thermo(o: GaugeOptions, room: Room): TemplateResult {
  const { w, h, small } = room;
  const c = o.value === null || !Number.isFinite(o.value) ? null : celsius(o.value, o.reads?.unit);
  const weather = weatherOf(c);
  const text = textOf(o, c);
  const read = fitReading(
    text.value,
    text.unit,
    c === null ? '' : say(o.hass, comfortOf(c)),
    w - 2 * insetOf(room),
    h / 2,
    small,
  );
  const plan = skyPlan(room, weather, read);
  const g = plan.ground;
  // the ground: a hill rising and falling across the room
  const hill = (dip: number): string =>
    `M0,${px(g + 2)} C${px(w * 0.25)},${px(g - plan.lift)} ${px(w * 0.45)},${px(g + dip)} ${px(w * 0.7)},${px(g - plan.lift * 0.6)} S${px(w * 0.95)},${px(g + 1)} ${w},${px(g - 2)}`;
  const land = (dip: number): string => `${hill(dip)} V${h} H0 Z`;
  const extreme = weather === 'extreme';
  const art =
    weather === 'cold'
      ? svg`${plan.flakes.map(
          (f, i, all) => svg`<g
            class="fc-snow"
            style=${`--d:${px(4 + ((i * 37) % 30) / 10)}s;--delay:${px(-(i * (4 + ((i * 37) % 30) / 10)) / all.length)}s;--fall:${px(f.fall)}px;--sway:${i % 2 ? 6 : -6}px`}
          >${flake(f.x, f.y, f.r)}</g>`,
        )}<path class="fc-sky__drift" d=${land(3)} /><path class="fc-sky__edge" d=${hill(3)} />`
      : weather === 'mild' && plan.sun && plan.cloud
        ? svg`${sunArt(plan.sun, 36, 5, small)}<g
              class="fc-drift"
              style=${`--d:${small ? 16 : 22}s;--span:${px(plan.cloud.span)}px`}
            ><path class="fc-sky__cloud" d=${cloudPath(plan.cloud)} /></g
            ><path class="fc-sky__hill" d=${land(2)} />`
        : (weather === 'warm' || extreme) && plan.sun
          ? svg`${sunArt(plan.sun, extreme ? 9 : 18, extreme ? 2.2 : 3.6, small)}${plan.haze.map(
              (s, i) => hazeArt(s, i, extreme),
            )}<path class="fc-sky__ground ${extreme ? 'fc-sky__ground--dunes' : ''}" d=${land(extreme ? 4 : 2)} />${plan.cacti.map(
              (each) => cactus(each, g),
            )}`
          : svg`<path class="fc-sky__plain" d=${land(1)} />`;
  return html`<div
    class=${root(`fc-scene--box fc-sky fc-sky--${weather}`, room, 'neutral', o.style.animate && c !== null)}
    style="width:${w}px;height:${h}px"
    data-measure="drawn"
  >
    <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true">${art}</svg>
    ${reading(read, plan.reading)}
  </div>`;
}

/* ---------- the marks: the battery, the pulse, the air and the sun ---------- */

/** A mark's room: the reading under it laid out for the width, and the height left over it. */
function underMark(room: Room, text: { value: string; unit: string }, word: string) {
  const gap = room.small ? 8 : 12;
  const read = fitReading(text.value, text.unit, word, room.w, room.h / 2, room.small);
  return { read, tall: room.h - read.h - gap, gap };
}

/** A mark scene: the drawing over its reading, centred, `gap` between them. */
const mark = (
  kind: string,
  room: Room,
  tone: string,
  moving: boolean,
  gap: number,
  art: TemplateResult,
  read: Reading,
): TemplateResult =>
  html`<div
    class=${root(`fc-scene--mark ${kind}`, room, tone, moving)}
    style="width:${room.w}px;height:${room.h}px;gap:${gap}px"
    data-measure="drawn"
  >
    ${art}${reading(read)}
  </div>`;

/**
 * The battery: its charge as a level in the battery's tone (the warning's under 40 %, the danger's under 20 %), a slow
 * wave on it; while it charges, bubbles rise through it as fast as it fills and the bolt glows on it.
 */
function battery(o: GaugeOptions, room: Room): TemplateResult {
  const share = shareOf(o);
  const climb = climbOf(o);
  const charging = share !== null && climb > CLIMBING;
  const { read, tall, gap } = underMark(
    room,
    textOf(o, share),
    charging ? say(o.hass, 'gauge.charging') : (o.label ?? ''),
  );
  const nub = room.small ? 4 : 6;
  const bodyH = tall - nub;
  const bodyW = Math.round((bodyH * 0.47) / 2) * 2;
  const tone =
    share === null ? 'neutral' : share < 0.2 ? 'danger' : share < 0.4 ? 'warning' : o.tone;
  // the well inside the body: its 2.5 border and 4 of air either side
  const wellW = bodyW - 13;
  const wellH = bodyH - 13;
  const y = share === null ? wellH : wellH - wellH * share;
  const bolt = Math.round(bodyH * 0.21);
  const art = html`<div class="fc-battery__shape" style="width:${bodyW}px;height:${tall}px">
    <span class="fc-battery__nub" style="height:${nub + 2}px"></span>
    <span
      class="fc-battery__body"
      style="height:${bodyH}px;border-radius:${Math.round(bodyW * 0.21)}px"
    >
      <span class="fc-battery__well" style="border-radius:${Math.round(bodyW * 0.13)}px">
        <svg width=${wellW} height=${wellH} viewBox="0 0 ${wellW} ${wellH}" aria-hidden="true">
          ${
            share === null
              ? nothing
              : svg`<path
                  class="fc-wave fc-battery__charge"
                  d=${wavePath(-28, wellW + 56, y, 2, 28, wellH)}
                  style="--d:5s;--shift:-28px"
                />`
          }
          ${
            charging
              ? bubbles(
                  { x: 4, y: y + 6, w: wellW - 8, h: Math.max(0, wellH - y - 6) },
                  room.small ? 4 : 6,
                  climb < 0.1 ? 3.6 : climb < 0.3 ? 2.4 : 1.3,
                )
              : nothing
          }
        </svg>
      </span>
      ${
        charging
          ? html`<svg
              class="fc-battery__bolt"
              width=${Math.round((bolt * 16) / 28)}
              height=${bolt}
              viewBox="0 0 16 28"
              aria-hidden="true"
            >
              <path class="fc-bolt" d="M10,0 L1,16 H8 L6,28 L15,12 H8 Z" />
            </svg>`
          : nothing
      }
    </span>
  </div>`;
  return mark('fc-battery', room, tone, o.style.animate && share !== null, gap, art, read);
}

/** How fast a power beats: 3.2 s under a kilowatt, 1.8 s under three, 0.95 s above (by its share in another unit). */
const beatOf = (o: GaugeOptions, share: number): number => {
  const kw = o.reads?.unit === 'W' ? (o.value as number) / 1000 : share * 6;
  return kw < 1 ? 3.2 : kw < 3 ? 1.8 : 0.95;
};

/** The pulse (power): a disc in the tone with the bolt, its halo breathing and rings that beat as fast as the power. */
function pulse(o: GaugeOptions, room: Room): TemplateResult {
  const share = shareOf(o);
  const on = share !== null && (o.value as number) > 0;
  const { read, tall, gap } = underMark(room, textOf(o, share), o.label ?? '');
  const s = Math.min(room.w, tall);
  const c = s / 2;
  const r = Math.round(s * 0.2);
  const period = on ? beatOf(o, share) : 3.2;
  const art = html`<svg
    width=${s}
    height=${tall}
    viewBox=${`0 ${px((s - tall) / 2)} ${s} ${tall}`}
    aria-hidden="true"
  >
    ${
      on
        ? [0, 1, 2].map(
            (i) => svg`<circle
              class="fc-pulse__ring"
              cx=${c}
              cy=${c}
              r=${r}
              style=${`--d:${period}s;--delay:${px((-period * i) / 3)}s;--k:${px((c - 2) / r)}`}
            />`,
          )
        : nothing
    }
    <circle
      class="fc-breath fc-pulse__halo"
      cx=${c}
      cy=${c}
      r=${px(r + (6 * s) / 100)}
      style=${`--d:${period}s;--o1:.12;--o2:.24`}
    />
    <circle class="fc-pulse__disc" cx=${c} cy=${c} r=${r} />
    <path
      class="fc-pulse__bolt"
      d=${`M${px(c + r / 10)},${px(c - r * 0.55)} l${px(-r * 0.42)},${px(r * 0.62)} h${px(r * 0.34)} l${px(-r * 0.1)},${px(r * 0.5)} l${px(r * 0.42)},${px(-r * 0.62)} h${px(-r * 0.34)} z`}
    />
  </svg>`;
  return mark(
    'fc-pulse',
    room,
    share === null ? 'neutral' : o.tone,
    o.style.animate && on,
    gap,
    art,
    read,
  );
}

/** How fast the wind runs and what it is: 4.2 s calm under 10 km/h, 2.2 s a breeze under 30, 0.9 s strong above. */
const windOf = (o: GaugeOptions, share: number): { speed: number; word?: KeyOf<'chart'> } => {
  const factor = KMH[o.reads?.unit ?? ''];
  // a flow that is no wind: by its share of the range, and no word of the wind's
  if (factor === undefined) return { speed: share < 0.2 ? 4.2 : share < 0.6 ? 2.2 : 0.9 };
  const kmh = (o.value as number) * factor;
  return kmh < 10
    ? { speed: 4.2, word: 'gauge.calm' }
    : kmh < 30
      ? { speed: 2.2, word: 'gauge.breeze' }
      : { speed: 0.9, word: 'gauge.strong' };
};

/** The air (wind, a ventilation's flow): streamlines in a band of their own over the reading, as fast as the wind. */
function air(o: GaugeOptions, room: Room): TemplateResult {
  const share = shareOf(o);
  const on = share !== null && (o.value as number) > 0;
  const wind = share === null ? undefined : windOf(o, share);
  const { read, tall, gap } = underMark(
    room,
    textOf(o, share),
    wind?.word ? say(o.hass, wind.word) : (o.label ?? ''),
  );
  const { w } = room;
  const count = clamp(Math.round((tall - 20) / 16) + 1, 3, 7);
  const lines = Array.from({ length: count }, (_unused, i) => {
    const y = 10 + ((tall - 20) * i) / (count - 1);
    const len = 28 + ((i * 17) % 30);
    const rest = 70 + ((i * 23) % 40);
    return svg`<path
      class="fc-dash fc-air__line"
      d=${wavePath(-20 - ((i * 26) % 163), w + 20, y, 3, 163)}
      stroke-dasharray=${`${len} ${rest}`}
      stroke-opacity=${px(0.4 + 0.15 * (i % 3))}
      style=${`--d:${px((wind?.speed ?? 4.2) * (0.85 + 0.1 * i))}s;--loop:-${len + rest}px`}
    />`;
  });
  const art = html`<div class="fc-air__band" style="width:${w}px;height:${tall}px">
    <svg width=${w} height=${tall} viewBox="0 0 ${w} ${tall}" aria-hidden="true">${lines}</svg>
  </div>`;
  return mark(
    'fc-air',
    room,
    share === null ? 'neutral' : o.tone,
    o.style.animate && on,
    gap,
    art,
    read,
  );
}

/** The sun (production): rays that lengthen with what it gives and turn faster (60, 34, 16 s), its halo breathing. */
function sun(o: GaugeOptions, room: Room): TemplateResult {
  const share = shareOf(o);
  const on = share !== null && share > 0;
  const f = share ?? 0;
  const { read, tall, gap } = underMark(room, textOf(o, share), o.label ?? '');
  const s = Math.min(room.w, tall);
  const c = s / 2;
  const k = s / 100;
  const r = 17 * k;
  const ray = (6 + f * 14) * k;
  const rays = Array.from({ length: 12 }, (_unused, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const r0 = r + 6 * k;
    const r1 = r0 + ray * (i % 2 ? 0.7 : 1);
    return svg`<line
      x1=${px(c + Math.cos(a) * r0)}
      y1=${px(c + Math.sin(a) * r0)}
      x2=${px(c + Math.cos(a) * r1)}
      y2=${px(c + Math.sin(a) * r1)}
    />`;
  });
  const art = html`<svg
    width=${s}
    height=${tall}
    viewBox=${`0 ${px((s - tall) / 2)} ${s} ${tall}`}
    aria-hidden="true"
  >
    <circle
      class="fc-breath fc-sun__glow"
      cx=${c}
      cy=${c}
      r=${px(r + 8 * k)}
      style=${`--d:5s;--o1:${px(0.1 + f * 0.15)};--o2:${px(0.18 + f * 0.25)}`}
    />
    <g
      class="fc-spin fc-sun__rays"
      stroke-width=${room.small ? 2 : 2.5}
      style=${`--d:${f < 1 / 6 ? 60 : f < 0.5 ? 34 : 16}s;transform-origin:${px(c)}px ${px(c)}px`}
    >
      ${rays}
    </g>
    <circle class="fc-sun__core" cx=${c} cy=${c} r=${px(r)} />
  </svg>`;
  return mark(
    'fc-sun',
    room,
    share === null ? 'neutral' : o.tone,
    o.style.animate && on,
    gap,
    art,
    read,
  );
}

/**
 * A moving gauge in its room, `size` wide and `height` tall: a tile's type and margins under 168 across, or where the
 * card says `small`.
 */
export function drawScene(o: GaugeOptions): TemplateResult {
  const room: Room = {
    w: o.size,
    h: o.height ?? o.size,
    small: o.small === true || o.size < TILE_BELOW,
  };
  const preset: GaugePreset = o.style.preset;
  switch (preset) {
    case 'thermo':
      return thermo(o, room);
    case 'tank':
      return water(o, room, true);
    case 'battery':
      return battery(o, room);
    case 'pulse':
      return pulse(o, room);
    case 'air':
      return air(o, room);
    case 'sun':
      return sun(o, room);
    default:
      return water(o, room, false);
  }
}
