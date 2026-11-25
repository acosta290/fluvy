import {
  formatNumber,
  numberAttr,
  valueParts,
  withMinus,
  type EntityView,
  type HomeAssistant,
} from '@fluvy/core';
import type { Tone } from '@fluvy/ui';
import { css, html, nothing, type TemplateResult } from 'lit';
import { fractionOf } from '../gauge/signed.js';
import { figureForms, type RoundSpec, type RoundsHost } from './rounds.js';
import type { Band } from './thresholds.js';

/*
 * A round's gauge (1.26, #257, after @zokmedov's proposal): a reading drawn on the round itself — an arc round its
 * edge, an arc from zero, a sector, a flood — over its fill and under its glyph, in whatever shape the round has (a
 * circle, a key, a pill, a row's circle): a layer the sheet below draws, its share one number. What it reads (the
 * state or an attribute), its range and its words are read here too. A chunk of its own, fetched by the first card
 * whose rounds name a gauge (`rounds.ts`): a house of plain rounds never pays for it.
 */

/** The styles: the arc from the top all the way round, the arc either side of zero, the sector, the flood. */
export const GAUGES = ['arc', 'zero', 'sector', 'fill'] as const;
export type GaugeStyle = (typeof GAUGES)[number];

/** What a round's gauge reads: its share of its range, its words, its band. */
export interface GaugeReading {
  /** Where it stands: 0–1 of its range, −1–1 either side of zero; none where it is no number or its range is unknown. */
  readonly fraction?: number | undefined;
  /** Its reading in words, longest first, where the gauge's own keys word it (`decimals`, `attribute`). */
  readonly said?: readonly string[] | undefined;
  readonly band?: Band | undefined;
}

/** The classes whose readings are a share of a hundred, whatever unit they say. */
const SHARES: ReadonlySet<string> = new Set(['battery', 'humidity', 'moisture']);

/** `decimals` as the figures are written in: 0 to 3, none where it says none. */
const digitsOf = (decimals: unknown): number | undefined =>
  typeof decimals === 'number' && decimals >= 0 ? Math.min(3, Math.floor(decimals)) : undefined;

/** An attribute as a number: one, or words that write one ("21.5"); nothing else (a list, a flag, no words). */
const numberOf = (raw: unknown): number =>
  typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;

/** A figure rounded to nothing has no sign: "−0.0" would say a reading under zero that is none. */
const unsigned = (figure: string): string =>
  /[1-9]/.test(figure) ? figure : figure.replace(/^−/, '');

/**
 * What stands after the figure where Home Assistant writes an attribute ("21.5 °C": "°C"; "85%": "%"): its unit, none
 * where it writes the figure alone or does not know the attribute.
 */
function attributeUnit(hass: HomeAssistant | undefined, view: EntityView, name: string): string {
  try {
    const written = hass?.formatEntityAttributeValue?.(view.stateObj!, name, view.attr(name));
    return typeof written === 'string' ? written.replace(/^[^\p{L}%°]*/u, '').trim() : '';
  } catch {
    return '';
  }
}

/**
 * A gauge's reading: the entity's state, or its `attribute`, as a number; its words where `decimals` or the
 * attribute word it — the figure in exactly those decimals with a real minus, its unit after it, in the forms a round
 * says a figure in (`figureForms`) — and where it stands in its range: `min` and `max` as the card reads a figure of
 * its own (a number, an entity, a template), else the entity's own `min` and `max`, else 0 to 100 for a share (a
 * percentage, a battery, a humidity, a moisture); from zero, `min` is `max` below it where nothing says another. A
 * reading past an end stands on it.
 */
export function readGauge(host: RoundsHost, item: RoundSpec, view: EntityView): GaugeReading {
  const { hass } = host;
  const name = typeof item.attribute === 'string' && item.attribute ? item.attribute : undefined;
  const raw = name ? numberOf(view.attr(name)) : (view.number ?? NaN);
  const value = Number.isFinite(raw) ? raw : undefined;
  const digits = digitsOf(item.decimals);
  const unit = name ? attributeUnit(hass, view, name) : view.unit;
  let said: string[] | undefined;
  if (value !== undefined && (name || digits !== undefined)) {
    const exact = digits === undefined ? {} : { digits, minDigits: digits };
    const worded = name
      ? { value: withMinus(formatNumber(hass, value, exact)), unit }
      : valueParts(hass, view, exact);
    said = figureForms(unsigned(worded.value), worded.unit);
  }
  const own = (figure: unknown): number | undefined =>
    figure === undefined
      ? undefined
      : host.card
        ? host.card.ownFigure(figure, unit, view.id).value
        : typeof figure === 'number'
          ? figure
          : undefined;
  const given = (key: 'min' | 'max'): number | undefined =>
    own(item[key]) ?? (name ? undefined : (numberAttr(view, key) ?? undefined));
  const max = given('max') ?? (unit === '%' || SHARES.has(view.deviceClass) ? 100 : undefined);
  const min = given('min') ?? (item.gauge !== 'zero' ? 0 : max === undefined ? undefined : -max);
  const fraction =
    value === undefined || min === undefined || max === undefined
      ? undefined
      : item.gauge === 'zero'
        ? fractionOf(value, min, max)
        : max > min
          ? Math.min(1, Math.max(0, (value - min) / (max - min)))
          : undefined;
  return { fraction, said, band: host.card?.band(item, view, value ?? null) };
}

/*
 * The share as the sheet reads it, a number of its own so it can ease from one reading to the next (an unregistered
 * custom property steps): where an engine cannot register one, or a second copy of the bundle already has, the gauge
 * draws as it does, unanimated at worst.
 */
try {
  CSS.registerProperty({
    name: '--fv-gauge',
    syntax: '<number>',
    inherits: true,
    initialValue: '0',
  });
} catch {
  /* drawn all the same */
}

/**
 * The gauges' sheet, adopted by the card that draws one (`wearGauge`). The layer takes the round's own shape and
 * stands under its glyph and its words (what follows it in the round is raised over it). Its ink is its tone's — the
 * fill's own on a lit round — its track 16 % of that ink and its wash 20 %, which keeps a resting glyph 3:1 on it in
 * every palette. One family: a line is the ink along the round's edge (the arc, the sector's rim, the edge a flood
 * wets), an area the wash.
 */
const SHEET = css`
  .rg {
    --rg-ink: var(--tone-ink);
    --rg-track: color-mix(in srgb, var(--rg-ink) 16%, transparent);
    --rg-wash: color-mix(in srgb, var(--rg-ink) 20%, transparent);
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
    transition: --fv-gauge var(--fv-slow) var(--fv-ease);
  }
  .is-on > .rg {
    --rg-ink: currentColor;
  }
  .rg ~ * {
    position: relative;
  }
  /* the line: a 3 px band along the round's edge, lit where the style says */
  .rg::before {
    content: '';
    position: absolute;
    inset: 0;
    padding: 3px;
    border-radius: inherit;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }
  /* the arc: its share of a whole turn, on its track */
  .rg--arc::before {
    background: conic-gradient(var(--rg-ink) calc(var(--fv-gauge) * 1turn), var(--rg-track) 0);
  }
  /* from zero: zero at the top, a reading above it to the right and one under it to the left, each side 135° of the
     turn, the two ends apart at the foot; a tick stands on zero */
  .rg--zero::before {
    background: conic-gradient(
      var(--rg-ink) calc(max(var(--fv-gauge), 0) * 135deg),
      var(--rg-track) 0 135deg,
      transparent 0 225deg,
      var(--rg-track) 0 calc(360deg + min(var(--fv-gauge), 0) * 135deg),
      var(--rg-ink) 0
    );
  }
  .rg--zero::after {
    content: '';
    position: absolute;
    top: 0;
    left: calc(50% - 1px);
    width: 2px;
    height: 7px;
    border-radius: 0 0 1px 1px;
    background: var(--rg-ink);
  }
  /* the sector: its share of the turn washed, its rim the ink */
  .rg--sector {
    background: conic-gradient(var(--rg-wash) calc(var(--fv-gauge) * 1turn), transparent 0);
  }
  .rg--sector::before {
    background: conic-gradient(var(--rg-ink) calc(var(--fv-gauge) * 1turn), transparent 0);
  }
  /* the flood: washed from the foot up to its share, the edge it wets the ink (no line across the round: it would
     strike through its glyph and its words) */
  .rg--fill {
    background: linear-gradient(to top, var(--rg-wash) calc(var(--fv-gauge) * 100%), transparent 0);
  }
  .rg--fill::before {
    background: linear-gradient(to top, var(--rg-ink) calc(var(--fv-gauge) * 100%), transparent 0);
  }
`;

/** The gauges' sheet on the card's root, after its own, once. */
export function wearGauge(root: Node | undefined): void {
  const sheet = SHEET.styleSheet;
  if (root instanceof ShadowRoot && sheet && !root.adoptedStyleSheets.includes(sheet))
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

/**
 * A gauge's layer, the first thing in its round: `style` at `fraction` (none: its track alone), in `tone` and the
 * colour that redefines it (`accent`), which the round itself wears only while it is on. A drawing to the measurer:
 * its box is its round's, whatever width a line's share gives that.
 */
export const drawGauge = (
  style: GaugeStyle,
  fraction: number | undefined,
  tone: Tone,
  accent: string | undefined,
): TemplateResult =>
  html`<span
    class="rg rg--${style} fv-tone--${tone}"
    data-accent=${accent ?? nothing}
    style="--fv-gauge:${(fraction ?? 0).toFixed(3)}"
    data-measure="drawn"
    aria-hidden="true"
  ></span>`;
