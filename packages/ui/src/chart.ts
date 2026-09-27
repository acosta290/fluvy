import { html, nothing, svg, type TemplateResult } from 'lit';
import { textWidth } from './text.js';

/** Chart maths kept pure (and tested); the templates below only draw what these return. */

export interface CurveGeometry {
  readonly line: string;
  readonly area: string;
  readonly cursorX: number;
  readonly cursorY: number;
  readonly top: number;
}

export interface CurveOptions {
  readonly w: number;
  readonly h: number;
  readonly pad?: number;
  /** Headroom above the curve (room for a value bubble). */
  readonly padTop?: number;
  /** Fraction of the width the series covers: a 24 h axis at 21:47 → 0.908. */
  readonly extent?: number;
  /** Cursor position as a fraction of the width; defaults to the end of the series ("now"). */
  readonly cursor?: number | undefined;
}

/** Smooth curve through the points: Catmull-Rom converted to cubic Béziers. */
export function curveGeometry(values: readonly number[], o: CurveOptions): CurveGeometry | null {
  if (values.length < 2 || !values.every(Number.isFinite) || !(o.w > 0) || !(o.h > 0)) return null;
  const pad = o.pad ?? 8;
  const top = o.padTop ?? pad;
  const span = Math.max(1, o.w * (o.extent && o.extent > 0 ? Math.min(1, o.extent) : 1));
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const flat = max === min;
  const pts = values.map((v, i): [number, number] => [
    (i / (values.length - 1)) * span,
    flat ? top + (o.h - top - pad) / 2 : top + (1 - (v - min) / range) * (o.h - top - pad),
  ]);
  let d = `M${pts[0]![0].toFixed(2)},${pts[0]![1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6] as const;
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6] as const;
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  const cursorX =
    (o.cursor !== undefined && Number.isFinite(o.cursor) ? clamp01(o.cursor) : span / o.w) * o.w;
  const cf = Math.min(Math.max(cursorX / span, 0), 1);
  const seg = Math.min(Math.floor(cf * (values.length - 1)), values.length - 2);
  const t = cf * (values.length - 1) - seg;
  const cursorY = pts[seg]![1] + (pts[seg + 1]![1] - pts[seg]![1]) * t;
  return { line: d, area: `${d} L${span.toFixed(2)},${o.h} L0,${o.h} Z`, cursorX, cursorY, top };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** The series' value at a fraction of its length, interpolated between the two nearest points — what the dot at that x stands on. */
export function sampleAt(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0] ?? null;
  const at = clamp01(fraction) * (values.length - 1);
  const i = Math.min(Math.floor(at), values.length - 2);
  const t = at - i;
  return (values[i] as number) + ((values[i + 1] as number) - (values[i] as number)) * t;
}

/**
 * The fluvy curve: gradient fill, a 2.5 px line that draws itself in, a dashed cursor and a dot at "now".
 * The gradient id only has to be unique inside the card's shadow root, so it is stable by default (no
 * attribute churn on every update); a card drawing two curves of different tones passes its own ids.
 */
export function curve(
  values: readonly number[],
  o: CurveOptions,
  gradientId = 'fv-fill',
): TemplateResult {
  const g = curveGeometry(values, o);
  if (!g) return html`<div class="fv-skeleton" style="height:${o.h}px"></div>`;
  return html`<svg
    class="fv-curve"
    width=${o.w}
    height=${o.h}
    viewBox="0 0 ${o.w} ${o.h}"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id=${gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="curve-fill-a" />
        <stop offset="1" class="curve-fill-b" />
      </linearGradient>
    </defs>
    ${svg`<path class="curve-area" d=${g.area} fill="url(#${gradientId})" stroke="none" />
    <path class="curve-line" d=${g.line} pathLength="1" />
    <line class="curve-cursor" x1=${g.cursorX} y1=${Math.max(g.top, g.cursorY + 7)} x2=${g.cursorX} y2=${o.h} />
    <circle class="curve-dot" cx=${g.cursorX} cy=${g.cursorY.toFixed(2)} r="5" />`}
  </svg>`;
}

/* ---------- several series on one scale (the History page's charts) ---------- */

export interface PlotOptions {
  readonly w: number;
  readonly h: number;
  /** Headroom over the highest reading: the room a value bubble needs. */
  readonly padTop?: number;
  readonly pad?: number;
  /** The scale every series of a chart shares, so two curves can be compared by eye. */
  readonly min: number;
  readonly max: number;
  /** A recorder's readings hold until the next one: `step` draws them as they happened, `smooth` as they felt. */
  readonly step?: boolean;
}

/** Where a value sits in the plot, in px from its top. */
export function plotY(value: number, o: PlotOptions): number {
  const pad = o.pad ?? 8;
  const top = o.padTop ?? pad;
  const range = o.max - o.min || 1;
  const clamped = Math.min(o.max, Math.max(o.min, value));
  return top + (1 - (clamped - o.min) / range) * (o.h - top - pad);
}

const px = (n: number): string => n.toFixed(2);

/**
 * One series of a chart, on the scale the chart shares: stepped (what the recorder actually holds) or smoothed with
 * Catmull-Rom segments. Values are evenly spaced across the width. Fewer than two readings draw nothing.
 */
export function seriesPath(values: readonly number[], o: PlotOptions): string {
  if (values.length < 2 || !values.every(Number.isFinite) || !(o.w > 0) || !(o.h > 0)) return '';
  const points = values.map((v, i): [number, number] => [
    (i / (values.length - 1)) * o.w,
    plotY(v, o),
  ]);
  let d = `M${px(points[0]![0])},${px(points[0]![1])}`;
  if (o.step) {
    for (const [x, y] of points.slice(1)) d += ` H${px(x)} V${px(y)}`;
    return d;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6] as const;
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6] as const;
    d += ` C${px(c1[0])},${px(c1[1])} ${px(c2[0])},${px(c2[1])} ${px(p2[0])},${px(p2[1])}`;
  }
  return d;
}

/**
 * Where the drawn curve actually is at an x: the same segments `seriesPath` writes, solved for that x. A cursor's
 * dot reads this, never the raw series — the line is drawn from samples, and a dot placed on a value the line does
 * not pass through hangs off it. Returns null when there is nothing drawn.
 */
export function seriesY(values: readonly number[], o: PlotOptions, x: number): number | null {
  if (values.length < 2 || !values.every(Number.isFinite) || !(o.w > 0) || !(o.h > 0)) return null;
  const last = values.length - 1;
  const d = o.w / last;
  const at = Math.min(Math.max(x, 0), o.w);
  const i = Math.min(last - 1, Math.max(0, Math.floor(at / d)));
  const y = (k: number): number => plotY(values[k] as number, o);
  if (o.step) return y(at >= o.w ? last : i);
  // the segment's control points, as seriesPath builds them
  const p0y = y(i - 1 >= 0 ? i - 1 : i);
  const p1y = y(i);
  const p2y = y(i + 1);
  const p3y = y(i + 2 <= last ? i + 2 : i + 1);
  const x1 = i * d;
  const c1y = p1y + (p2y - p0y) / 6;
  const c2y = p2y - (p3y - p1y) / 6;
  // x moves with t as the same cubic does: even spacing makes the interior segments linear, the ends nearly so
  const cx1 = x1 + (i === 0 ? d / 6 : d / 3);
  const cx2 = x1 + d - (i + 1 === last ? d / 6 : d / 3);
  const bez = (a: number, b: number, c: number, e: number, t: number): number => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e;
  };
  let t = (at - x1) / d;
  for (let pass = 0; pass < 4; pass++) {
    const fx = bez(x1, cx1, cx2, x1 + d, t) - at;
    const u = 1 - t;
    const dx = 3 * u * u * (cx1 - x1) + 6 * u * t * (cx2 - cx1) + 3 * t * t * (x1 + d - cx2) || 1;
    t = Math.min(1, Math.max(0, t - fx / dx));
  }
  return bez(p1y, c1y, c2y, p2y, t);
}

/** The area under a series (a chart of one series fills it; several would muddy each other). */
export const areaUnder = (path: string, o: PlotOptions): string =>
  path ? `${path} L${px(o.w)},${px(o.h)} L0,${px(o.h)} Z` : '';

/**
 * The band a summarised series moved in: its highs across and its lows back, closed — drawn behind the mean, so an
 * hour that swung between 18 and 24 says so instead of pretending it was 21 all along.
 */
export function bandPath(low: readonly number[], high: readonly number[], o: PlotOptions): string {
  const count = Math.min(low.length, high.length);
  if (count < 2 || !(o.w > 0)) return '';
  const x = (i: number): number => (i / (count - 1)) * o.w;
  let d = `M${px(x(0))},${px(plotY(high[0] as number, o))}`;
  for (let i = 1; i < count; i++) d += ` L${px(x(i))},${px(plotY(high[i] as number, o))}`;
  for (let i = count - 1; i >= 0; i--) d += ` L${px(x(i))},${px(plotY(low[i] as number, o))}`;
  return `${d} Z`;
}

/**
 * The scale a chart's series share: their ends with a tenth of the range as air, and a flat series centred instead of
 * drawn on the floor. `zero` keeps the floor at zero for what only grows from it (power, rain).
 */
export function plotScale(
  series: readonly (readonly number[])[],
  zero = false,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const values of series)
    for (const v of values) {
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min: min - 1, max: max + 1 };
  const air = (max - min) / 10;
  return { min: zero && min >= 0 ? 0 : min - air, max: max + air };
}

export interface BubbleOptions {
  /** Where the dot is, in the chart's px. */
  readonly x: number;
  /** The chart's width: the bubble stays inside it. */
  readonly width: number;
  readonly value: string;
  readonly unit?: string;
  /** While scrubbed, when that was ("10:15"). */
  readonly time?: string;
  /** The chart's face (the card's font family). */
  readonly family?: string;
}

/**
 * The value bubble over a chart's dot: the value (15/700), its unit and, while scrubbed, the time (13/500), 12 px sides,
 * never narrower than 80, on the 4 grid — sized by the shared measurer, as the page lays it out. It stays inside the
 * chart, its tail on the dot (on the pill's straight part).
 */
export function chartBubble(o: BubbleOptions): TemplateResult {
  const family = o.family;
  const face = (size: number, weight: number) => ({
    size,
    weight,
    tabular: true,
    ...(family ? { family } : {}),
  });
  const unit = o.unit ? ` ${o.unit}` : '';
  const text =
    textWidth(o.value, face(15, 700)) +
    (unit ? 2 + textWidth(unit, face(13, 500)) : 0) +
    (o.time ? 2 + 4 + textWidth(o.time, face(13, 500)) : 0);
  const width = Math.max(80, Math.ceil((Math.ceil(text) + 24) / 4) * 4);
  // at either end the bubble leans into the card's own padding rather than let its tail leave the dot
  const lean = 16;
  const left = Math.min(Math.max(o.x - width / 2, -lean), Math.max(-lean, o.width - width + lean));
  const tail = Math.min(Math.max(Math.round(o.x - left - 6), 8), width - 20);
  return html`<span
    class="fv-bubble is-visible"
    data-measure="value"
    style="left:${left.toFixed(2)}px;width:${width}px;--tail:${tail}px"
    ><b>${o.value}</b>${unit}${
      o.time ? html`<span class="fv-bubble__time">${o.time}</span>` : nothing
    }</span
  >`;
}

export interface BarDatum {
  readonly value: number;
  readonly tone?: 'on' | 'off' | 'forecast';
}

/** Rounded vertical bars on a shared baseline (hourly production, consumption). Widths land on whole pixels. */
export function bars(
  data: readonly BarDatum[],
  o: { w: number; h: number; max?: number; gap?: number },
): TemplateResult {
  const gap = o.gap ?? 4;
  const count = Math.max(1, data.length);
  const bw = Math.max(2, Math.floor((o.w - gap * (count - 1)) / count));
  const used = bw * count + gap * (count - 1);
  const x0 = Math.floor((o.w - used) / 2);
  const value = (d: BarDatum): number => (Number.isFinite(d.value) ? Math.max(0, d.value) : 0); // a hole in the data is an empty hour, never NaN
  let max = o.max !== undefined && o.max > 0 ? o.max : 0;
  if (!(max > 0)) for (const d of data) max = Math.max(max, value(d));
  max = Math.max(0.0001, max);
  return html`<svg
    class="fv-bars"
    width=${o.w}
    height=${o.h}
    viewBox="0 0 ${o.w} ${o.h}"
    aria-hidden="true"
  >
    ${data.map((d, i) => {
      const v = value(d);
      const bh = Math.max(v > 0 ? 4 : 2, Math.round((Math.min(v, max) / max) * o.h));
      return svg`<rect class="fv-vbar fv-vbar--${d.tone ?? 'on'}" x=${x0 + i * (bw + gap)} y=${o.h - bh} width=${bw} height=${bh} rx=${Math.min(3, bw / 2)} style="animation-delay:${i * 18}ms" />`;
    })}
  </svg>`;
}
