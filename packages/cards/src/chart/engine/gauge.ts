import { html, nothing, svg, type TemplateResult } from 'lit';
import type { ResolvedGauge } from './presets.js';
import { arcDash, knobAt } from './ring.js';

/**
 * The gauges (the owner's call, 2026-10-26: no circles of the engine's own): every one is Fluvy's controls read-only.
 * `ticks` is the gauge card's ring since 1.0 (`<fluvy-dial gauge>`: 54 ticks over 270° lit to the value, the figure
 * in its opening); `dial` the thermostat's dial read (`<fluvy-dial readonly>`: the ticks, its disc with the reading,
 * its knob on the value); `ring` a ring of the border lit to the value in the tone, Fluvy's knob at its end and the
 * reading in its middle; `ruler` the ruler in its read-only form (`<fluvy-ruler marker>`, lit to the value). The
 * animated gauges come in a later block through the same door: a style in `GAUGE_PRESETS` that says it moves, drawn
 * still on its first frame when the house or the card says `animate: false` or the system asks for less motion.
 */

const px = (n: number): string => n.toFixed(2);

export interface GaugeOptions {
  readonly style: ResolvedGauge;
  /** The drawing's width: a dial's or a ring's box, a ruler's length. */
  readonly size: number;
  readonly min: number;
  readonly max: number;
  /** The reading; null when it cannot be read: nothing lit, no knob, its text "—". */
  readonly value: number | null;
  /** The reading as the card writes it. */
  readonly format: (value: number) => string;
  readonly unit?: string;
  /** The words over the figure inside a dial (the gauge card's label). */
  readonly label?: string;
  /** The range's ends, written under a dial. */
  readonly minLabel?: string;
  readonly maxLabel?: string;
  /** The tone the gauge is lit in. */
  readonly tone: string;
  /** A tile's drawing: the small dial, a thinner ring. */
  readonly small?: boolean;
}

/** The value's share of the range, 0 … 1; null when there is none to light. */
const share = (o: GaugeOptions): number | null =>
  o.value === null || !Number.isFinite(o.value) || !(o.max > o.min)
    ? null
    : Math.min(1, Math.max(0, (o.value - o.min) / (o.max - o.min)));

/** A dial's radius in a box of `size`: its ticks and their 12 px of room inside it, on the 4 grid (the gauge card's rule). */
export const dialRadius = (size: number, tick: number): number =>
  Math.max(24, Math.floor((size / 2 - tick - 12) / 4) * 4);

/** The dial, read: its ticks (and, `readonly`, its disc and knob), as the gauge card and the thermostat draw it. */
function dial(o: GaugeOptions, readonly: boolean): TemplateResult {
  const tick = o.small ? 8 : 12;
  const f = share(o);
  return html`<fluvy-dial
    ?gauge=${!readonly}
    ?readonly=${readonly}
    .radius=${dialRadius(o.size, tick)}
    .tick=${tick}
    .large=${!o.small}
    .stepper=${false}
    .tone=${f === null ? 'neutral' : o.tone}
    .min=${o.min}
    .max=${o.max}
    .fill=${f ?? 0}
    .value=${o.value ?? undefined}
    .unit=${f === null ? '' : (o.unit ?? '')}
    .label=${o.label ?? ''}
    .text=${f === null ? '—' : undefined}
    .minLabel=${o.minLabel ?? ''}
    .maxLabel=${o.maxLabel ?? ''}
    .format=${o.format}
    ?disabled=${f === null}
  ></fluvy-dial>`;
}

/** The ring: the border's circle, lit from the top to the value in the tone (round caps), Fluvy's knob at its end. */
function ring(o: GaugeOptions): TemplateResult {
  const stroke = o.small ? 8 : 10;
  const knob = o.small ? 20 : 24;
  const c = o.size / 2;
  // the knob's ring (2) stays inside the box
  const r = c - knob / 2 - 2;
  const f = share(o);
  const [kx, ky] = knobAt(c, c, r, -90, 360, f ?? 0);
  const text = f === null ? '—' : o.format(o.value as number);
  return html`<div
    class="fc-gauge fc-ring ${o.small ? 'fc-gauge--small' : ''} fv-tone--${f === null ? 'neutral' : o.tone}"
    style="width:${o.size}px;height:${o.size}px"
  >
    <svg
      width=${o.size}
      height=${o.size}
      viewBox="0 0 ${o.size} ${o.size}"
      aria-hidden="true"
      data-measure="drawn"
    >
      <circle class="fc-ring__track" cx=${c} cy=${c} r=${px(r)} stroke-width=${stroke} />
      ${
        f === null || f === 0
          ? nothing
          : svg`<circle class="fc-ring__lit" cx=${c} cy=${c} r=${px(r)} stroke-width=${stroke} stroke-dasharray=${arcDash(f, r)} transform=${`rotate(-90 ${c} ${c})`} />`
      }
    </svg>
    ${
      f === null
        ? nothing
        : html`<span
            class="fv-knob fc-knob"
            data-measure="value"
            style="left:${px(kx - knob / 2)}px;top:${px(ky - knob / 2)}px;width:${knob}px;height:${knob}px"
          ></span>`
    }
    <div class="fc-gauge__value">
      ${o.label ? html`<span class="fc-gauge__label">${o.label}</span>` : nothing}
      <b data-measure="value">${text}</b
      >${o.unit && f !== null ? html`<span>${o.unit}</span>` : nothing}
    </div>
  </div>`;
}

/** The ruler in its read-only form: lit to the value, its marker on it. */
function ruler(o: GaugeOptions): TemplateResult {
  const f = share(o);
  return html`<fluvy-ruler
    marker
    .length=${o.size}
    .min=${o.min}
    .max=${o.max}
    .value=${o.value ?? o.min}
    .tone=${f === null ? 'neutral' : o.tone}
    ?inactive=${f === null}
    .unit=${o.unit ?? ''}
    .label=${o.label ?? ''}
    .format=${o.format}
  ></fluvy-ruler>`;
}

/** A gauge in its style, `size` wide: a dial's or a ring's box (the reading inside it), or a ruler's length. */
export function drawGauge(o: GaugeOptions): TemplateResult {
  switch (o.style.preset) {
    case 'dial':
      return dial(o, true);
    case 'ring':
      return ring(o);
    case 'ruler':
      return ruler(o);
    default:
      return dial(o, false);
  }
}
