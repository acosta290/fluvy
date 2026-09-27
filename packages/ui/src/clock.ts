import { html, svg, type TemplateResult } from 'lit';
import type { Tone } from './parts.js';

export interface ClockFaceOptions {
  /** Radius of the tick ring. The whole family scales with it: 120 (hero), 96, 72 (side), 56 (tile). */
  readonly R?: number;
  readonly tone?: Tone;
  readonly numerals?: 'none' | 'quarters' | 'all';
  readonly seconds?: boolean;
  readonly time: Date;
  /** Reduced motion: hands are placed, not swept. */
  readonly still?: boolean;
  /** Accessible name of the face (the time as text); defaults to the platform's own short time. */
  readonly label?: string;
}

/**
 * The analog face: the ruler's ticks bent into a circle. Majors R/10, minors R/20 (majors only at
 * R 56); hour hand 0.52 R inside the numerals, minute 0.85 R and second 0.88 R over the numerals to
 * the tick ring; only the second hand carries a counterweight; the cap is the fluvy knob without halo.
 *
 * Hands are drawn at 12 o'clock inside a group that CSS rotates: they start at the current angle and
 * sweep on the compositor (60 s / 1 h / 12 h per turn), so a running clock costs no JavaScript.
 */
export function clockFace(o: ClockFaceOptions): TemplateResult {
  const R = o.R ?? 120;
  const tone = o.tone ?? 'accent';
  const pad = 12;
  const w = (R + pad) * 2;
  const c = R + pad;
  const cap = R >= 96 ? 28 : R >= 72 ? 20 : 16;
  const majorLen = Math.round(R / 10);
  const minorLen = Math.round(R / 20);
  const widths = R >= 96 ? [6, 4, 2] : R >= 72 ? [5, 3, 2] : [4, 3, 2];

  const ticks: TemplateResult[] = [];
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    if (!major && R < 72) continue;
    const a = ((i * 6 - 90) * Math.PI) / 180;
    const r1 = R - (major ? majorLen : minorLen);
    ticks.push(
      svg`<line x1=${(c + r1 * Math.cos(a)).toFixed(2)} y1=${(c + r1 * Math.sin(a)).toFixed(2)} x2=${(c + R * Math.cos(a)).toFixed(2)} y2=${(c + R * Math.sin(a)).toFixed(2)} class=${major ? 'ck-major' : 'ck-minor'} />`,
    );
  }

  const set =
    o.numerals === 'all'
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      : o.numerals === 'quarters'
        ? [12, 3, 6, 9]
        : [];
  const numerals = set.map((n) => {
    const a = ((n * 30 - 90) * Math.PI) / 180;
    const r = R * 0.75;
    return svg`<text x=${(c + r * Math.cos(a)).toFixed(2)} y=${(c + r * Math.sin(a)).toFixed(2)} class="ck-num ${R < 72 ? 'ck-num--s' : ''}" text-anchor="middle" dominant-baseline="central">${n}</text>`;
  });

  const time = Number.isFinite(o.time.getTime()) ? o.time : new Date(0); // an invalid date draws midnight, never NaN hands
  const h = time.getHours();
  const m = time.getMinutes();
  const s = time.getSeconds() + time.getMilliseconds() / 1000;
  const hand = (
    deg: number,
    length: number,
    width: number,
    cls: string,
    period: number,
    tail = 0,
  ): TemplateResult =>
    svg`<g class="ck-hand" style="transform-origin:${c}px ${c}px;--from:${deg.toFixed(3)}deg;${o.still ? `transform:rotate(${deg.toFixed(3)}deg)` : `animation:fv-sweep ${period}s linear infinite`}"><line x1=${c} y1=${c + tail} x2=${c} y2=${(c - length).toFixed(2)} class=${cls} stroke-width=${width} /></g>`;

  const label =
    o.label ?? time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return html`<div
    class="ck-face ck-face--${tone}"
    style="width:${w}px;height:${w}px"
    role="img"
    aria-label=${label}
  >
    <svg width=${w} height=${w} viewBox="0 0 ${w} ${w}" aria-hidden="true">
      ${ticks}${numerals}
      ${hand(((h % 12) + m / 60 + s / 3600) * 30, R * 0.52, widths[0]!, 'ck-hour', 43200)}
      ${hand((m + s / 60) * 6, R * 0.85, widths[1]!, 'ck-minute', 3600)}
      ${o.seconds === false ? '' : hand(s * 6, R * 0.88, widths[2]!, 'ck-second', 60, cap / 2 + 8)}
    </svg>
    <span
      class="fv-knob fv-knob--${tone}"
      data-measure="value"
      style="left:${c - cap / 2}px;top:${c - cap / 2}px;width:${cap}px;height:${cap}px"
    ></span>
  </div>`;
}

/** ISO 8601 week number. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
