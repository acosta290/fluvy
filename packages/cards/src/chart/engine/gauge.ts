import type { HomeAssistant } from '@fluvy/core';
import { html, nothing, svg, type TemplateResult } from 'lit';
import { GAUGE_PRESETS, type Reads, type ResolvedGauge } from './presets.js';
import { arcDash, knobAt } from './ring.js';
import { drawScene, fitReading, reading } from './scenes.js';

/**
 * The gauges (the owner's call, 2026-10-26: no circles of the engine's own): the still ones are Fluvy's controls read.
 * `ticks` is the gauge card's ring since 1.0 (`<fluvy-dial gauge>`: 54 ticks over 270° lit to the value, the figure
 * in its opening); `dial` the thermostat's dial read (`<fluvy-dial readonly>`: the ticks, its disc with the reading,
 * its knob on the value — in a tile a knob its ring can carry, touching the disc's rim as the thermostat's does);
 * `ring` a ring of the border lit to the value in the tone, Fluvy's knob at its end and the reading in its middle;
 * `ruler` the ruler read (`<fluvy-ruler readonly>`, lit to the value, its knob whole, its reading under it). Every
 * knob is the thermostat's ball, its dot and its lift on its halo. The gauges that move with what they read
 * (`GAUGE_PRESETS` says which) are scenes in the gauge's room (`scenes.ts`), still on their first frame when the house
 * or the card says `animate: false` or the system asks for less motion.
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
  /** A tile's drawing: the small dial, a thinner ring, a moving gauge's smaller type. */
  readonly small?: boolean;
  /** A moving gauge's room is `size` wide and this tall (none: square). */
  readonly height?: number;
  /** What the sensor reads: its device class and the unit `value` is in (a °F, a W, an m/s a moving gauge reads). */
  readonly reads?: Reads;
  /** How fast the reading moves, in its unit an hour (the card's last hour): a tank filling, a battery charging. */
  readonly rise?: number | null | undefined;
  /** The house, for the words a moving gauge says (the comfort, the wind) in its language. */
  readonly hass?: HomeAssistant | undefined;
  /** The drawing alone, the reading written elsewhere by the card (the humidity's liquid, under its figure). */
  readonly bare?: boolean;
}

/** The value's share of the range, 0 … 1; null when there is none to light. */
const share = (o: GaugeOptions): number | null =>
  o.value === null || !Number.isFinite(o.value) || !(o.max > o.min)
    ? null
    : Math.min(1, Math.max(0, (o.value - o.min) / (o.max - o.min)));

/** The read dial's knob in a tile: its 40 ring carries 20, which touches the disc's rim and leaves the reading whole. */
const TILE_KNOB = 20;

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
    .knob=${readonly && o.small ? TILE_KNOB : undefined}
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

/**
 * The ruler read: lit to the value, its knob whole on it, and its reading under it, centred, as a mark's is (the
 * drawing alone where the card writes the reading itself: `bare`).
 */
function ruler(o: GaugeOptions): TemplateResult {
  const f = share(o);
  const control = html`<fluvy-ruler
    readonly
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
  if (o.bare) return control;
  const read =
    f === null
      ? fitReading('—', '', '', o.size, Infinity, o.small === true)
      : fitReading(
          o.format(o.value as number),
          o.unit ?? '',
          '',
          o.size,
          Infinity,
          o.small === true,
        );
  return html`<div class="fc-gauge fc-gauge--ruler ${o.small ? 'fc-gauge--small' : ''}">
    ${control}${reading(read)}
  </div>`;
}

/**
 * A gauge in its style, `size` wide: a dial's or a ring's box (the reading inside it), a ruler's length, or a moving
 * gauge's room (`height` tall).
 */
export function drawGauge(o: GaugeOptions): TemplateResult {
  if (GAUGE_PRESETS[o.style.preset].motion) return drawScene(o);
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
